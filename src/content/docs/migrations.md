# Migrations

Upgrade guides for truce's breaking major releases. Each section is
self-contained: follow the steps for the version you're jumping to. For
the full release notes behind these changes, see the
[changelog](changelog.md).

## Upgrading to 6.0 (from 5.x)

6.0 moves saving custom state completely off the audio thread, so even a
large serialize can't glitch audio when the host saves during playback.
The only source change is for plugins that save **custom** state - state
beyond parameters - by overriding `save_state`. Plugins that keep
everything in parameters (including `#[persist]` fields) need no change.

Custom state is now published through `snapshot_into` instead of
`save_state`. `snapshot_into` writes into a buffer the framework hands you
and reuses each block, which is what lets the host read it back without
ever touching the running plugin. `save_state` still exists (the
framework calls it off-thread and it delegates to `snapshot_into`), but
overriding it no longer reaches the host.

Move your `save_state` body into `snapshot_into`: write into the buffer
instead of returning a `Vec`, and return `true` (or `false` for "no
custom state"). `load_state` is unchanged.

```diff
-fn save_state(state: &MyDsp) -> Vec<u8> {
-    encode(&state.extra)
-}
+fn snapshot_into(state: &MyDsp, buf: &mut Vec<u8>) -> bool {
+    encode_into(&state.extra, buf);   // append your bytes to `buf`
+    true
+}
```

If your custom state is a `#[derive(State)]` struct, its generated
`serialize_into` already fits:

```diff
+fn snapshot_into(state: &MyDsp, buf: &mut Vec<u8>) -> bool {
+    state.extra.serialize_into(buf);
+    true
+}
```

Keep `snapshot_into` cheap and allocation-free: it runs on the audio
thread after every block. `serialize_into` reuses the buffer's capacity,
so a steady state never allocates.

## Upgrading to 5.0 (from 4.x)

5.0 reworks the background-task API and changes the default bus layout.
The only source break is the task API, and only if your plugin uses it.

### Background tasks

The `BackgroundTasks` trait - implemented once on the plugin, with a
`type Task` and a `run_task(task, params)` function - is replaced by
`BackgroundTask`, implemented on **each task type**. The handler is
`run(self, params)`: the request that used to arrive as the `task`
argument is now `self`. Each task type also carries an optional
`const SERIALIZED: bool` (default `false`); set it to `true` for a
handler that must never run on two workers at once (one that
read-modify-writes a non-atomic scratch buffer or cache). `truce::plugin!`
now takes a bracketed list of task types, one lane each.

Move the impl onto the task type and bracket the `tasks:` value:

```diff
-impl BackgroundTasks for Reverb {
+impl BackgroundTask for Rebuild {
     type Params = ReverbParams;
-    type Task = Rebuild;
-    fn run_task(task: Rebuild, params: &ReverbParams) {
-        let graph = build_graph(task.sample_rate, task.time_s);
+    // const SERIALIZED: bool = true;   // add for a non-reentrant handler
+    fn run(self, params: &ReverbParams) {
+        let graph = build_graph(self.sample_rate, self.time_s);
         let _ = params.ready.force_push(graph);
     }
 }

-truce::plugin! { logic: Reverb, params: ReverbParams, tasks: Reverb }
+truce::plugin! { logic: Reverb, params: ReverbParams, tasks: [Rebuild] }
```

`task.field` reads become `self.field`. Scheduling is unchanged:
`ctx.tasks::<Rebuild>()` still returns the spawner, and `try_spawn` /
`spawn_coalescing` are the same. To run more than one kind of task, list
them all - `tasks: [Rebuild, Analyze]` - and select the lane by type at
the call site.

### Bus layouts (no code change, changed behavior)

`bus_layouts()` now defaults to `BusLayout::stereo_and_mono()` instead of
stereo-only, so an effect that took the default appears on **mono tracks**
too. Nothing to edit, but a mono track hands `process` a one-channel
buffer: loop over `buffer.channels()` rather than assuming two. If you want
the old stereo-only behavior back, override with
`vec![BusLayout::stereo()]`.

## Upgrading to 4.0 (from 3.x)

4.0 turns `PluginLogic` into a stateless *descriptor*: its methods are
associated functions - no `&self` - that take the data they touch as
arguments. That separates the three kinds of per-plugin data, and a
method's signature now says which it may read or mutate:

- **Parameters** (`type Params`, a `#[derive(Params)]` struct) - the
  host-automatable values, passed read-only to the audio methods as
  `&Self::Params` and to the editor as `Arc<Self::Params>`.
- **Saved state** (`save_state` / `load_state`, with `#[derive(State)]`) -
  the opaque bytes the host persists in a project or preset. Unchanged.
- **DSP state** (`type DspState`, a plain struct) - the instance-local
  audio memory (filter buffers, oscillator phase, a voice pool). It lives
  in the shell, so a hot-reload keeps it alive across a code-only edit.

`reset` also now takes `&AudioConfig` instead of `(sample_rate,
max_block_size)`; read `config.sample_rate` / `config.max_block_size`, and
branch on `config.process_mode` for offline rendering.

Every plugin makes the same three moves, whatever its state:

- Move the non-params fields (filter memory, phase, voices) off the plugin -
  now a stateless descriptor - into `type DspState`. Parameters were
  already a separate `#[derive(Params)]` struct and don't move.
- Replace `fn new(params: Arc<..>) -> Self` with `fn init(params:
  &Self::Params, cx: &InitContext) -> Self::DspState`, which builds that
  state. There is no stored `params` `Arc` anymore. Most plugins ignore
  `cx` (write `_cx`); it's there to schedule startup background work.
- Give each method `state` / `params` instead of `&self`.

The examples below show `init` in its current form. `init` gained the
`cx: &InitContext` argument in 4.1; on exactly 4.0 it's
`fn init(params: &Self::Params) -> Self::DspState` with no `cx`.

The only choice is where the DSP state lives.

### No DSP state - `PurePluginLogic`

A pure parameter-driven effect keeps nothing between blocks, so it
implements `PurePluginLogic` and the state plumbing disappears
entirely - no `type DspState`, no `init`, no `state` argument, and no
`reset` (the shell snaps the smoothers for you):

```rust
pub struct Gain;

impl PurePluginLogic for Gain {
    type Params = GainParams;
    fn process(params: &GainParams, buffer: &mut AudioBuffer, _events: &EventList, _ctx: &mut ProcessContext) -> ProcessStatus {
        let g = db_to_linear(params.gain.read()); /* ... */
    }
    fn editor(params: Arc<GainParams>) -> Box<dyn Editor> { /* ... */ }
}
```

A blanket impl makes it a `PluginLogic` with `DspState = ()`, so
`truce::plugin!` and every format consume it unchanged. (You can also
stay on `PluginLogic` and write `type DspState = ()` if you prefer.)

### `type DspState = Self`

A small self-contained effect keeps its DSP fields on the plugin struct,
which becomes its own state. One type instead of two:

```rust
pub struct Tremolo {                   // holds the DSP fields directly...
    phase: f64,
    sample_rate: f64,
}

impl PluginLogic for Tremolo {
    type Params = TremoloParams;
    type DspState = Self;              // ...and is its own DSP state
    fn init(_params: &TremoloParams) -> Self {
        Tremolo { phase: 0.0, sample_rate: 44100.0 }
    }
    fn reset(state: &mut Self, params: &TremoloParams, config: &AudioConfig) {
        state.sample_rate = config.sample_rate;
    }
    fn process(state: &mut Self, params: &TremoloParams, /* ... */) -> ProcessStatus { /* ... */ }
}
```

### `type DspState = MyDspState` - a separate struct

Clearest once the state grows or you want the plugin type to stay a bare
marker (a synth, a voice pool). The three moves show as a before/after on
a 3.x plugin:

```diff
-struct MyPlugin {
-    params: Arc<MyParams>,
-    filter: Filter,
-    phase: f32,
-}
+struct MyPlugin;                 // stateless descriptor
+
+struct MyDspState {              // the former non-params fields
+    filter: Filter,
+    phase: f32,
+}

 impl PluginLogic for MyPlugin {
     type Params = MyParams;
+    type DspState = MyDspState;

-    fn new(params: Arc<MyParams>) -> Self {
-        Self { params, filter: Filter::default(), phase: 0.0 }
+    fn init(_params: &MyParams) -> MyDspState {
+        MyDspState { filter: Filter::default(), phase: 0.0 }
     }

-    fn reset(&mut self, sample_rate: f32, max_block_size: usize) {
-        self.filter.set_rate(sample_rate);
+    fn reset(state: &mut MyDspState, params: &MyParams, config: &AudioConfig) {
+        state.filter.set_rate(config.sample_rate);
     }

-    fn process(&mut self, buffer: &mut AudioBuffer, events: &EventList, ctx: &mut ProcessContext) -> ProcessStatus {
+    fn process(state: &mut MyDspState, params: &MyParams, buffer: &mut AudioBuffer, events: &EventList, ctx: &mut ProcessContext) -> ProcessStatus {
         // self.filter -> state.filter, self.params -> params
     }
     // editor is unchanged - still fn editor(params: Arc<Self::Params>) (see 3.0)
 }
```

`params` (read-only) and the host-saved state stay separate from
`DspState` throughout - the method signatures make it unambiguous which a
call may touch.

## Upgrading to 3.0 (from 2.x)

3.0 refactored `editor` into an associated function: it takes the
parameter store as an argument (`Arc<Self::Params>`) instead of borrowing
the plugin (`&self`). The editor is now, by construction, a function of
its parameters, so building it can't take the plugin lock or reach into
DSP state. For almost every plugin this is a one-line signature change.

Moving `editor` also shifted the hot-reload ABI, so a `--shell` shell and
its logic dylib must be rebuilt and reinstalled together (GUI edits still
hot-reload on the next editor close and reopen; static shipped builds need
nothing).

1. **Update each editor.** Add `type Params`, take `params` instead of
   `&self`, and use it in the body. For a typical plugin (the editor only
   reads `self.params`) that's the whole migration:

   ```diff
    impl PluginLogic for MyPlugin {
   +    type Params = MyParams;
   +
        // reset, process, ...
   -    fn editor(&self) -> Box<dyn Editor> {
   -        default_editor(self.params.clone(), layout())
   +    fn editor(params: Arc<MyParams>) -> Box<dyn Editor> {
   +        default_editor(params, layout())
        }
    }
   ```

   The same `self.params` -> `params` swap covers the other backends:
   `.into_editor(&params)`, `EguiEditor::new(params, ...)`,
   `IcedEditor::new(params, ...)`, and so on.

2. **Only if an editor read live DSP state at construction** (an analyzer
   handing its spectrum to the GUI, say): it no longer has `self`. Route
   the shared handle through the params struct as a `#[skip]` field (a
   non-parameter), fill it in `new()`, and read it back in `editor`:

   ```diff
    #[derive(Params)]
    pub struct MyParams {
        #[param(name = "Gain", /* ... */)] pub gain: FloatParam,
   +    #[skip]
   +    spectrum: Arc<OnceLock<Arc<Spectrum>>>,
    }

    fn new(params: Arc<MyParams>) -> Self {
        let spectrum = Arc::new(Spectrum::new());
   +    let _ = params.spectrum.set(spectrum.clone());
        Self { params, spectrum, /* ... */ }
    }

   -    fn editor(&self) -> Box<dyn Editor> {
   -        MyEditor::new(self.params.clone(), self.spectrum.clone())
   +    fn editor(params: Arc<MyParams>) -> Box<dyn Editor> {
   +        let spectrum = params.spectrum.get().expect("set in new()").clone();
   +        MyEditor::new(params.clone(), spectrum)
        }
   ```

3. **Rebuild `--shell` pairs together.** A 3.0 shell won't pair with a 2.x
   logic dylib; rebuild and reinstall both in one pass. Ordinary
   (non-`--shell`) builds need nothing beyond step 1.

## Upgrading to 2.0 (from 1.x)

2.0 was a MIDI overhaul: MIDI 2.0 / UMP and multiple MIDI ports, opt-in
per plugin. Existing MIDI-1.0, single-port plugins are unchanged at
runtime; the API breaks below are what a source upgrade has to touch.

- **`Event` gained a `port` field** - the MIDI port an event arrived on or
  should go out on (`0` for single-port plugins).
- **Every plugin identity derives from `bundle_id`.** `clap_id` /
  `vst3_id` / the state-envelope hash no longer follow the display name,
  so renaming a plugin no longer changes its identity.
- **`EventList::sort` is removed.** It was a std stable sort, which
  allocates - unusable on the audio thread.

Steps:

1. **Pin your identity first.** 2.0 derives `clap_id` / `vst3_id` / the
   state hash from `bundle_id`, not the display name. If a 1.x build ever
   shipped, set `bundle_id` to the old name-derived slug (the display name
   lowercased with spaces stripped: "Truce Envelope" -> `truceenvelope`);
   otherwise hosts treat the plugin as new and old sessions won't find it.
   Unshipped plugins pick any valid id.

2. **Fix `Event` construction.** Struct literals need the new `port`
   field; prefer the constructors:

   ```diff
   -    Event { sample_offset, body }
   +    Event::new(sample_offset, body)              // port 0, the common case
   +    Event::on_port(sample_offset, port, body)    // explicit port
   ```

   Reads (`event.port`) are unaffected.

3. **Replace `EventList::sort()`** with `ensure_sorted_by_offset()`, the
   allocation-free equivalent with the same stable-by-offset semantics.

4. **Rebuild everything together.** The hot-reload canary and the AU v3
   framework/appex handshake are version-checked: a 2.x shell refuses a
   1.x logic dylib and the appex refuses a 1.x framework, so rebuild and
   reinstall all artifacts in one pass instead of mixing.

5. **Loads fail honestly now.** State the plugin doesn't recognize no
   longer resets to defaults - implement `migrate_state` (plus
   `[plugin.legacy_state]` keys for keyed formats) if you need to accept
   pre-truce or re-identified blobs; otherwise nothing to do. See the
   [state guide](guide/state.md).

6. **MIDI stays opt-in.** Single-port MIDI 1.0 plugins behave exactly as
   on 1.x; add `midi2` / `midi_input_ports` / `midi_output_ports` only
   when you want the new capabilities. See the [MIDI guide](guide/midi.md).
