# 3. Plugin anatomy

How the pieces of a truce plugin fit together: the `PluginLogic`
trait, the `truce::plugin!` macro, bus layouts, and state
persistence.

If you've walked through [first-plugin](first-plugin.md) this
chapter explains **why** the code you just wrote is shaped the way
it is.

## The moving parts

Four things you write:

1. A **params struct** with `#[derive(Params)]`.
2. A **plugin descriptor** — a stateless (usually zero-sized) struct.
   Any per-instance DSP state goes in a separate plain struct named by
   the descriptor's `type DspState`.
3. A single **`impl PluginLogic for ...`** block — DSP and GUI in
   one trait (`init`, `reset`, `process`, `editor`, `snapshot_into`,
   `load_state`, `state_changed`, `latency`, `tail`, `bus_layouts`,
   …). `reset`, `process`, and `editor` are required; every other
   method has a default.
4. A **single `truce::plugin!` macro call** that wires those into
   every plugin format.

Everything else — parameter hosting, GUI event dispatch, state
envelope, format-specific lifecycle, hot-reload shell — is
generated.

`PluginLogic` lives in `truce_plugin` (re-exported as
`truce::prelude::PluginLogic`). The trait covers both the
audio-thread surface (`process`, `reset`, …) and the main-thread
surface (`editor`); the framework guarantees the threading split —
`process()` only runs on the audio thread, `editor()` only on the
main thread.

## The four kinds of plugin data

Every method signature spells out exactly which
kind it may read or mutate. There are four, and they live in two
homes.

- **On the `Params` struct** - shared as `Arc<Self::Params>`, so the
  audio thread (`&Self::Params`) and the editor (`Arc<Self::Params>`)
  both reach it with no extra plumbing. Three kinds of field live
  here, told apart by two attributes.
- **In `type DspState`** - owned by the shell and handed only to the
  audio-thread methods (`&mut Self::DspState`). The editor never sees
  it.

| Kind | Declared as | Home | Host automation | Saved to session / preset | Reached by |
|------|-------------|------|-----------------|---------------------------|------------|
| **Parameter** | `#[param]` field | `Params` | yes | yes (automatic) | audio `&Params`; editor `Arc<Params>` |
| **Persisted state** | `#[persist]` field, or `snapshot_into` / `load_state` | `Params`, or `DspState` | no | yes | audio `&Params`; editor `Arc<Params>`, or `StateBinding` |
| **DSP state** | `type DspState` | shell | no | no | audio `&mut DspState`; editor none |
| **Skip state** | `#[skip]` field | `Params` | no | no | audio `&Params`; editor `Arc<Params>` |

The two right-hand behavior columns are the whole decision:

- **Should the host draw an automation lane for it?** It's a
  **parameter** (`#[param]`) - gain, frequency, mix, a mode selector.
  Saved automatically; see [parameters](parameters.md).
- **Must it survive session save and preset recall, but isn't a host
  control?** It's **persisted state**. Reach for a `#[persist]` field
  when it's small editor-facing config (a view mode, an instance
  label, a picked file path); reach for `snapshot_into` / `load_state`
  when it's an opaque or large blob tied to your DSP state (a decoded
  sample bank). Both routes are covered in [state](state.md).
- **Is it audio-thread working memory the editor never touches?**
  It's **DSP state** (`type DspState`) - filter buffers, oscillator
  phase, a voice pool. Never saved, and it lives in the shell so a
  hot-reload keeps it alive across a code-only swap.
- **Is it a live channel shared between the audio thread and the
  editor that must not be saved?** It's a **`#[skip]` field** - a
  lock-free ring of audio-thread events for a visualizer, a shared
  atomic flag. Not a parameter, not persisted; both sides reach it
  through the `Arc<Params>` they already share. See
  [Skipped fields](../reference/params.md#skipped-fields-skip).

A `#[skip]` field is **not** DSP state. DSP state is
audio-thread-exclusive - the shell never hands it to `editor()` - so
a value the GUI must read (a meter, an event ring) cannot live there.
It belongs on the `Params` struct as a `#[skip]` field, the one
object both threads share.

## Precision (preludes)

DSP precision is a per-file choice. `f32` is the host wire format
and the cheaper option; `f64` buys mantissa bits for long delay-line
accumulators, biquad cascades, and modulation math that drifts at
single precision. You pick by choosing a prelude at the top of the
file:

```rust
use truce::prelude::*;     // f32 — the default
// use truce::prelude64::*; // f64 end-to-end
```

The four variants follow fundsp's naming:

| Prelude | Buffer | `param.read()` | Notes |
|---------|--------|----------------|-------|
| `prelude`    | `f32` | `f32` | Default. Alias for `prelude32`. |
| `prelude32`  | `f32` | `f32` | Explicit form. |
| `prelude64`  | `f64` | `f64` | End-to-end `f64`. On formats with a 64-bit wire (VST3, VST2, CLAP) the plugin processes the host's `f64` buffers directly when the host runs a 64-bit chain; everywhere else the wrapper widens at the block boundary and narrows on the way out. |
| `prelude64m` | `f32` | `f64` | Mixed precision: the buffer stays at host `f32` (no boundary widening) while reads and intermediate math run in `f64`. Write `.to_f32()` at the buffer-write site. |

Each prelude swaps three things in lockstep: a `Sample` type alias,
the `FloatParamReadF32` / `FloatParamReadF64` extension trait that
`param.read()` resolves through, and the `PluginLogic` /
`PluginLogic64` leaf trait (re-exported as `PluginLogic` either way,
so `impl PluginLogic for X { ... }` is the same line regardless of
precision).

Reach for `prelude64m` when you want to handle the `f32` buffer
yourself; reach for `prelude64` when you want `f64` end-to-end - the
framework advertises 64-bit support to hosts that can use it (VST3
`kSample64`, VST2 `processDoubleReplacing`, CLAP 64-bit ports) and
converts at the block boundary for the rest.

**Don't import two of these in the same file.** The `read` / `value` /
`current` extension traits collide on method dispatch — that's the
right error if the file hasn't committed to a precision. If a helper
genuinely needs both (e.g., it processes both `AudioBuffer<f32>` and
`AudioBuffer<f64>`), name `truce_core::buffer::AudioBuffer<S>`
explicitly there and keep the prelude out of that scope.

## The `PluginLogic` trait

`reset`, `process`, and `editor` are required. Everything else has a
default. Override what you need.

```rust
pub trait PluginLogic: Send + 'static {
    type Params;
    type DspState;   // per-instance DSP state; `()` if the plugin has none

    // --- DSP (audio thread) ---
    fn init(params: &Self::Params) -> Self::DspState;

    fn reset(state: &mut Self::DspState, params: &Self::Params, config: &AudioConfig);

    fn process(
        state: &mut Self::DspState,
        params: &Self::Params,
        buffer: &mut AudioBuffer,
        events: &EventList,
        context: &mut ProcessContext,
    ) -> ProcessStatus;

    fn bus_layouts() -> Vec<BusLayout> { BusLayout::stereo_and_mono() }

    fn snapshot_into(state: &Self::DspState, buf: &mut Vec<u8>) -> bool { false }
    fn load_state(state: &mut Self::DspState, data: &[u8]) -> Result<(), StateLoadError> { Ok(()) }
    fn state_changed(state: &mut Self::DspState, params: &Self::Params) {}

    fn latency(state: &Self::DspState) -> u32 { 0 }
    fn tail(state: &Self::DspState) -> u32 { 0 }

    // --- GUI (main thread) ---
    fn editor(params: Arc<Self::Params>) -> Box<dyn Editor>;
}
```

### DSP methods

| Method | When called | Real-time? | Notes |
|--------|-------------|------------|-------|
| `reset` | Sample rate or block size changes; before the first `process` | no | Clear delay lines, reset filter state. The shell sets the sample rate and snaps the smoothers for you first. |
| `process` | Every audio block | **yes** — no alloc / lock / I/O | The audio thread. See [processing](processing.md). |
| `bus_layouts` | Plugin discovery / port enumeration | no | Supported audio bus configurations. Default is stereo and mono (`BusLayout::stereo_and_mono()`); instruments / sidechain / MIDI plugins override. See [Bus layouts](#bus-layouts) below. |
| `snapshot_into` / `load_state` | Host saves/loads a session, recalls a preset, or copies the plugin | `snapshot_into` only (audio thread, per block) | **Extra** state only — params are serialized automatically. Save custom state by implementing `snapshot_into` (serializes into a reused buffer the host reads without touching the plugin, so saving never stalls audio). `save_state` still exists but delegates to it; you don't override it. `load_state` returns `Result<(), StateLoadError>` so wrappers can surface a malformed blob to the host. See [state](state.md). |
| `state_changed` | After `load_state` returns | yes (audio thread, between blocks) | Plugin-side cache invalidation — receives `&mut Self::DspState` + `&Self::Params` to re-decode an IR, re-build a sample-pad map, anything derived from extra state that the next `process()` block reads. The companion `Editor::state_changed` (on `truce_core::Editor`) handles the GUI-thread repaint. |
| `latency` | Host bus reconfiguration | no | Samples of processing delay, for PDC. |
| `tail` | Host transport stop | no | Samples of audio produced after input stops (reverb, delay). |

### GUI method

| Method | When called | Real-time? | Notes |
|--------|-------------|------------|-------|
| `editor` | Editor open | no | Associated function `fn editor(params: Arc<Self::Params>)` - it takes the param store, not the DSP state. For the built-in widget set, build a `GridLayout` and finish with `.into_editor(&params)`; for a framework backend, construct an `EguiEditor` / `IcedEditor` / `SlintEditor` / hand-rolled `Editor` and finish with `.into_editor()`. See [gui](gui.md). |

`editor()` is required: the renderer is whichever editor you return,
and which crate your `Cargo.toml` pulls in. Post-load-state cache
invalidation lives on `state_changed` (audio thread) and, for the
editor, on the `Editor`'s own `state_changed` (GUI thread). See
[State persistence](#state-persistence) below.

### The descriptor and its DSP state

Your plugin type is a stateless descriptor (usually zero-sized). The
per-instance DSP state — filters, delay lines, phase counters —
lives in a separate **plain struct** you name through
`type DspState`, and `init` builds it from the params:

```rust
pub struct MyPlugin;

// A plain struct — no derive, no trait bound. The shell fingerprints
// its layout automatically at hot-reload time.
pub struct MyPluginDsp {
    extra_dsp_state: SomeFilter,
}

impl PluginLogic for MyPlugin {
    type Params = MyParams;
    type DspState = MyPluginDsp;

    fn init(_params: &MyParams) -> MyPluginDsp {
        MyPluginDsp { extra_dsp_state: SomeFilter::default() }
    }
    // ... reset, process, editor ...
}
```

The `truce::plugin!` macro calls `MyPlugin::init(&params)` once per
plugin instance. `init` receives the shared params by reference; it
returns only the DSP state, so the descriptor never stores params.
Every method that needs params receives `&Self::Params` as a
parameter.

The same `Arc<Params>` lives on the shell, and can be cloned into GUI
closures. One source of truth, no synchronization.

If a plugin has no DSP state at all - only `#[param]` fields - skip the
state plumbing entirely with `PurePluginLogic` (below), or stay on
`PluginLogic` and write `type DspState = ()`.

### `PurePluginLogic` - the stateless leaf

A pure parameter-driven effect - one whose output is a function of
params and input only - implements `PurePluginLogic` instead of
`PluginLogic`:

```rust
pub struct Gain;

impl PurePluginLogic for Gain {
    type Params = GainParams;

    fn process(params: &GainParams, buffer: &mut AudioBuffer,
               _events: &EventList, _ctx: &mut ProcessContext) -> ProcessStatus {
        /* ... */
    }

    fn editor(params: Arc<GainParams>) -> Box<dyn Editor> { /* ... */ }
}
```

No `type DspState`, no `init`, no `state` argument on `process` - and
no `reset` needed (the shell snaps the parameter smoothers for you).
Only `process` and `editor` are required. A blanket impl makes every
`PurePluginLogic` a `PluginLogic` with `DspState = ()`, so
`truce::plugin!` and every format wrapper consume it unchanged. When
the plugin grows DSP state, switch the header to `PluginLogic` and add
the `type DspState` + `state` argument. Both leaf traits are
re-exported by the prelude, so the impl header reads the same
regardless of precision.

## Lifecycle

1. **Host loads the plugin binary.** By this point `truce::plugin!`
   has already read `truce.toml` via `plugin_info!()`, emitted the
   format entry points, and wrapped `MyPlugin` in a format-specific
   shell.
2. **Shell creates `Arc<MyParams>`**, exposes it as the host-visible
   parameter tree, and calls `MyPlugin::init(&params)` to build the
   `DspState`.
3. **`PluginLogic::reset(state, params, config)`** runs once the
   sample rate and block size are known.
4. **Playback loop.** The shell drives
   `process(state, params, buffer, events, ctx)` on the audio thread,
   `editor()` on the main thread, and the host writes automation
   through atomics. If the sample rate changes, `reset` is called
   again. Saving a session triggers automatic parameter serialization
   plus `snapshot_into`; loading one calls `load_state`, then `reset`,
   then resumes `process`.
5. **The `DspState` is dropped** when the host unloads the plugin.

## Per-format display names

By default every format surfaces the same `name` from `truce.toml`.
A few situations call for different names per format — most often
running AU v2 and v3 side by side (Logic shows them in the same
list and the user has no way to tell which is which), or shipping
a beta in parallel with a release without colliding bundle IDs.
Set any of `clap_name`, `vst3_name`, `vst2_name`, `au_name`,
`au3_name`, `aax_name`, `lv2_name` on the `[[plugin]]` table:

```toml
[[plugin]]
name      = "Truce Gain"
bundle_id = "gain"
crate     = "truce-example-gain"
category  = "effect"
fourcc    = "TGan"
au3_name  = "Truce Gain (AUv3)"   # disambiguate from the AU v2
```

Overrides only change the display name the host shows. Bundle
filenames, IDs, and install paths still derive from `name` —
except `au3_name`, which doubles as the
`/Applications/{au3_name}.app` install path so two AU v3 builds
can coexist. See the [`truce.toml` reference](../reference/truce-toml.md) for the full list of `[[plugin]]` keys.

## Bus layouts

Supported audio bus configurations live on
`PluginLogic::bus_layouts()`. The host picks one; the others are
rejected at bus-config time before `process` is ever called.

### Default (stereo and mono)

The trait method's default is `BusLayout::stereo_and_mono()` - stereo
*and* mono, in that order. The default exists so an audio effect shows up
on both **mono and stereo tracks** in Logic Pro (and other hosts that
filter the insert menu by channel format) without declaring anything.
Leave it alone for a typical effect:

```rust
impl PluginLogic for MyGain {
    type Params = MyParams;
    type DspState = ();

    // bus_layouts omitted → BusLayout::stereo_and_mono()
    fn reset(/* … */) { /* … */ }
    fn process(/* … */) -> ProcessStatus { /* … */ }
}
```

Because the default now includes mono, a mono track hands `process` a
**one-channel** buffer. Loop over `buffer.channels()` rather than assuming
two - the shipped examples already do. For a stereo-only effect, override
with `vec![BusLayout::stereo()]`.

### Instrument (no audio input)

```rust
impl PluginLogic for MySynth {
    type Params = MySynthParams;
    type DspState = MySynthDsp;
    fn bus_layouts() -> Vec<BusLayout> {
        vec![BusLayout::new().with_output("Main", ChannelConfig::Stereo)]
    }
    /* reset, process … */
}
```

### Multiple layouts (host picks)

Return several layouts and the host picks the one its track needs. This
renegotiates on every format that can - CLAP (`audio-ports-config`), VST3
(`setBusArrangements`, tracked per instance), AU (the channel-capability
property, plus one AU v3 bus per layout), and AAX (one component per
layout). VST2 and LV2 stay on the first layout in the list, so put your
preferred default there.

```rust
impl PluginLogic for Widener {
    type Params = WidenerParams;
    type DspState = WidenerDsp;
    fn bus_layouts() -> Vec<BusLayout> {
        vec![
            BusLayout::new()
                .with_input("Main",  ChannelConfig::Mono)
                .with_output("Main", ChannelConfig::Stereo),
            BusLayout::stereo(),
        ]
    }
    /* reset, process … */
}
```

Handy constructors for the common sets: `BusLayout::mono()`,
`BusLayout::stereo()`, `BusLayout::stereo_and_mono()` (the effect
default), and `BusLayout::stereo_and_mono_output()` (output-only, for an
instrument that should appear on mono and stereo instrument tracks).

### Sidechain

```rust
impl PluginLogic for SidechainComp {
    type Params = SidechainCompParams;
    type DspState = SidechainCompDsp;
    fn bus_layouts() -> Vec<BusLayout> {
        vec![
            BusLayout::new()
                .with_input("Main",      ChannelConfig::Stereo)
                .with_input("Sidechain", ChannelConfig::Stereo)
                .with_output("Main",     ChannelConfig::Stereo),
            BusLayout::stereo(),              // fallback when no sidechain
        ]
    }
    /* reset, process … */
}
```

Inside `process`, channels are flat-indexed across buses: with the
above layout, `buffer.input(0)` / `(1)` is main L/R and `(2)` /
`(3)` is sidechain L/R. Use `buffer.num_input_channels()` to detect
which layout the host selected.

When a plugin declares several widths but its DSP is a fixed shape (a
`reverb_stereo` graph, a stereo filter block), let
`AudioBuffer::for_each_frame_io::<IN, OUT>` map that shape onto whichever
bus the host chose - a mono input fans into both graph inputs, a stereo
bus maps 1:1, with no per-width branch. `for_each_stereo_frame` is the
shorthand for the common `(2, 2)` case:

```rust
buffer.for_each_stereo_frame(|frame_in, frame_out| {
    let (l, r) = reverb.process_stereo(frame_in[0], frame_in[1]);
    frame_out[0] = l;
    frame_out[1] = r;
});
```

## State persistence

**Parameter values are saved and restored automatically** by the
format wrappers. The only time you implement `snapshot_into` /
`load_state` is when you have state that isn't a parameter -
loaded sample paths, custom curves, view mode, selection,
anything else the user can change.

### Option A: `#[derive(State)]` — recommended

Define a state struct, derive binary serialization, and wire it
into `PluginLogic`:

```rust
#[derive(State, Default)]
pub struct MyExtraState {
    pub ir_file_path: String,
    pub view_mode: u8,
    pub selected_ids: Vec<u32>,
}

pub struct MyPlugin;

pub struct MyPluginDsp {
    extra: MyExtraState,
    decoded_ir: DecodedIr,
}

impl PluginLogic for MyPlugin {
    type Params = MyParams;
    type DspState = MyPluginDsp;

    // Serialize into the buffer the framework reuses each block; the host
    // reads it back without touching the plugin. Return `false` for "none".
    fn snapshot_into(state: &MyPluginDsp, buf: &mut Vec<u8>) -> bool {
        state.extra.serialize_into(buf);
        true
    }

    fn load_state(state: &mut MyPluginDsp, data: &[u8]) -> Result<(), StateLoadError> {
        match MyExtraState::deserialize(data) {
            Some(s) => { state.extra = s; Ok(()) }
            None => Err(StateLoadError::Malformed("MyExtraState")),
        }
    }

    // Re-derive caches that depend on extra state (decoded IR,
    // sample thumbnails, computed pad layouts). Runs on the audio
    // thread under the same `&mut` borrow as `load_state`, so the
    // next `process()` block sees the refreshed caches.
    fn state_changed(state: &mut MyPluginDsp, _params: &MyParams) {
        state.decoded_ir = decode_ir(&state.extra.ir_file_path);
    }

    // ... reset, process, editor ...
}
```

Supported field types: `u8`..`u64`, `i8`..`i64`, `f32`, `f64`,
`bool`, `String`, `Vec<T>`, `Option<T>`, and nested `State`
structs. **Forward-compatible**: adding fields later means old
state blobs still deserialize, with defaults for new fields.

### Option B: bring your own serializer

If you need a specific format — JSON for human-readable presets,
`bincode` for structs with third-party types — you can do the
bytes yourself:

```rust
fn snapshot_into(state: &MyPluginDsp, buf: &mut Vec<u8>) -> bool {
    bincode::serialize_into(&mut *buf, &state.extra).unwrap();
    true
}

fn load_state(state: &mut MyPluginDsp, data: &[u8]) -> Result<(), StateLoadError> {
    let s = bincode::deserialize::<MyExtraState>(data)
        .map_err(|e| StateLoadError::Other(e.to_string()))?;
    state.extra = s;
    Ok(())
}
```

### How it works

The framework wraps the bytes `snapshot_into` writes in a binary
envelope with a plugin-ID hash, a version field, and the list of
`(param_id, f64)` parameter values. On load, the envelope is
validated (rejects state saved by a different plugin) and params are
restored **before** `load_state()` is called. You only ever see your
extra blob.

If your plugin has no extra state - only `#[param]` fields and
meters - don't implement `snapshot_into` / `load_state` at all. The
defaults (no snapshot / no-op) are fine.

### Editor state

If your editor reads extra state (e.g. a loaded IR path to draw a
waveform), it needs to know when state changes — preset recall,
undo, session load. Use `StateBinding<T>`:

```rust
struct MyEditor {
    state: StateBinding<MyExtraState>,
}

impl Editor for MyEditor {
    fn open(&mut self, parent: RawWindowHandle, context: PluginContext) {
        self.state = StateBinding::new(&context);
    }

    fn state_changed(&mut self) {
        self.state.sync();            // re-read from plugin
    }
}

// Reading:
let path = &self.state.get().ir_file_path;

// Writing (user renamed the instance):
self.state.update(|s| s.ir_file_path = new_path);
```

If your plugin is parameter-only (built-in editor, no extra
state), skip `StateBinding` — the built-in GUI polls parameters
every frame for free.

## What's next

- **[Chapter 4 → parameters](parameters.md)** — every attribute
  the derive macro accepts, plus meters and parameter groups.
- **[Chapter 5 → processing](processing.md)** — the shapes
  `process()` takes for effects, MIDI processors, and synths.
- **[Chapter 6 → fundsp](fundsp.md)** — using the fundsp DSL
  inside `process()` and rebuilding off the audio thread.
- **[Chapter 7 → midi](midi.md)** — reading and emitting MIDI
  events; per-format support; testing MIDI plugins.
- **[Chapter 8 → gui](gui.md)** — the built-in widget set and
  when to reach for a framework backend.
