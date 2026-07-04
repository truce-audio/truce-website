# `#[derive(Params)]` reference

Every attribute, range type, smoothing mode, and parameter type that the params derive accepts. For a narrative tour and recipes, see the [parameters chapter in the guide](../guide/parameters.md).

## `#[param(...)]` attribute keys

| Key | Example | Notes |
|-----|---------|-------|
| `id` | `id = 0` | Optional. When omitted, auto-assigned as a stable hash of the field name, so reordering or inserting params (including in nested structs) never shifts IDs. Set it to pin a specific value; an explicit `id` always wins. See [Parameter ID stability](#parameter-id-stability). |
| `name` | `name = "Gain"` | **Required.** Display name in host and GUI. |
| `short_name` | `short_name = "Gn"` | Abbreviated name for narrow strips. Defaults to `name`. |
| `range` | `range = "linear(-60, 6)"` | Value mapping. Inferred for `BoolParam` and `EnumParam<T>`. |
| `default` | `default = 0.0` | Default value in plain units. Defaults to range min. |
| `unit` | `unit = "dB"` | Display unit. Shapes the default formatter. Valid: `dB`, `Hz`, `ms`, `s`, `%`, `pan`, `st`. `%` is display-only scaling: the plain value is a `0..=1` fraction and the formatter multiplies by 100, so a 0-150% param is `range = "linear(0, 1.5)"`. Every other unit formats the plain value as-is. |
| `smooth` | `smooth = "exp(5)"` | Smoothing style + time in ms. See [Smoothing](#smoothing). |
| `group` | `group = "Filter"` | Parameter group surfaced by the host (CLAP module path / VST3 unit / AU group). |
| `flags` | `flags = "automatable \| bypass"` | Combination of: `automatable`, `hidden`, `readonly`, `bypass`. |
| `format` | `format = "format_cutoff"` | Method on the params struct that converts a `f64` value to a `String`. |
| `parse` | `parse = "parse_cutoff"` | Inverse of `format`. Method that parses a host text-input `&str` back to `f64`. |
| `chunk` | `chunk = false` | Opt this parameter out of sample-accurate sub-block chunking. Default `true`. Set to `false` for parameters too expensive to re-target mid-block (FFT sizes, lookahead lengths). See [parameters § Sample-accurate automation](../guide/parameters.md#sample-accurate-automation). |

The derive generates `MyParams::new()`, a `Default` impl, the full `Params` trait impl, and a typed `MyParamsParamId` enum (`#[repr(u32)]`) with one variant per parameter.

## Parameter types

| Field type | Default widget | Notes |
|------------|----------------|-------|
| `FloatParam` | knob | Continuous. Supports smoothing and custom formatting. |
| `BoolParam` | toggle | On / off. Range is implicit `0..1` — don't pass `range`. |
| `IntParam` | knob | Integer steps within a range. |
| `EnumParam<T>` | dropdown | Click-to-open list. `T` is a `#[derive(ParamEnum)]` enum; range is inferred from the variant count. |
| `MeterSlot` | meter | Read-only, written from `process()`, drawn by the GUI. Declared with `#[meter]`, not `#[param(...)]`. |

### Enum parameters

```rust
#[derive(ParamEnum)]
pub enum Waveform { Sine, Saw, Square, Triangle }

#[param(name = "Waveform")]
pub waveform: EnumParam<Waveform>,
```

Use `#[name = "..."]` on a variant to override its display text — the Rust name stays the same:

```rust
#[derive(ParamEnum)]
pub enum Direction {
    #[name = "Up/Down"]
    UpDown,
    Down,
}
```

### Meters

Meters are not parameters — they flow audio-thread → UI-thread instead of host → plugin. Declare them with `#[meter]`:

```rust
#[derive(Params)]
pub struct MyParams {
    #[param(name = "Gain", range = "linear(-60, 6)", unit = "dB", smooth = "exp(5)")]
    pub gain: FloatParam,

    #[meter] pub meter_l: MeterSlot,
    #[meter] pub meter_r: MeterSlot,
}
```

Parameters and meters share the generated `ParamId` enum. Write from `process()`, read in `editor()`:

```rust
// process():
context.set_meter(P::MeterL, buffer.output_peak(0));
context.set_meter(P::MeterR, buffer.output_peak(1));

// editor():
meter(&[P::MeterL, P::MeterR], "Level").rows(3)
```

The write is realtime-safe (atomic); the GUI reads the latest value every frame.

## Range types

```
range = "linear(-60, 6)"        # linear between min and max
range = "log(20, 20000)"        # logarithmic — frequency, time constants
range = "discrete(1, 16)"       # integer steps
range = "enum(4)"               # N discrete cases (rarely written by hand;
                                # EnumParam<T> infers this from the variant count)
```

`BoolParam` ranges are implicit `0..1`. `EnumParam<T>` ranges are inferred from `T`'s variant count.

## Smoothing

Host automation usually arrives block-rate. Smoothing interpolates between successive target values so there's no zipper noise on continuous parameters.

```
smooth = "none"            # instant jump. Right for toggles, enums, voice counts.
smooth = "linear(20)"      # linear ramp over 20 ms. Right for pan and mix.
smooth = "exp(5)"          # exponential one-pole, 5 ms. Right for gain and filter cutoff.
```

In `reset()`, prime the smoothers:

```rust
fn reset(&mut self, sample_rate: f64, _: usize) {
    self.params.set_sample_rate(sample_rate);
    self.params.snap_smoothers();
}
```

In `process()`, pull a smoothed value per sample with `.read()`:

```rust
let g = self.params.gain.read();
```

`.read()` returns `f32` or `f64` depending on the prelude in scope —
see [Precision (preludes)](../guide/plugin-anatomy.md#precision-preludes).
The method takes `&self` (the smoother state is atomic), so it
works through `Arc<Params>` without `&mut`.

### Read accessors

`FloatParam` exposes four read accessors:

| Method | What it returns | When to use |
|---|---|---|
| `.read()` | Next smoothed sample; advances the smoother. | Per-sample DSP loop. |
| `.read_into(&mut [f32])` | Fills the slice with the next `out.len()` smoothed samples; advances the smoother by `out.len()`. One atomic load + one atomic store per call, regardless of length. | Block-rate DSP — pair with vectorized math (`ops::*_block`, `math::*_block`) to amortize the atomic over a whole chunk. Pass `&mut scratch[..n]` to keep the smoother in lockstep with the consumed samples even when chunks vary in length. See the [processing chapter](../guide/processing.md#reading-smoothed-params-per-block) for the full slow-path / fast-path pattern. |
| `.current()` | Current smoothed value without advancing. | Peeking at the smoother without consuming a tick — e.g. a per-block snapshot. |
| `.value()` | The raw target value (last write from host automation / `set_normalized`), with no smoothing. | Threshold checks, structural decisions, anything that shouldn't react to the smoother's crawl. |

All four are trait methods (`FloatParamReadF32` / `FloatParamReadF64`) that the preludes bring into scope; the return type follows the prelude in use. `use truce::prelude::*;` gives you `f32`-returning versions, `use truce::prelude64::*;` gives you `f64`-returning versions, same call sites either way.

> The older `.read_block::<N>() -> [f32; N]` (and its `f64` variant) is deprecated since 0.53.0: it advanced the smoother by exactly `N` regardless of how many samples the caller consumed, which silently stepped the value at the next block boundary whenever the chunk length wasn't `N`. `.read_into(&mut scratch[..n])` is the same code shape on the same atomic-amortized fast path, with the hazard removed.

The canonical case for `.value()` is a parameter that drives a
*discrete* downstream decision rather than a continuous gain. The
[fundsp reverb](../examples/fundsp-reverb-worker) example reads
`Time` with `.value()` and triggers a graph rebuild when the raw
target drifts past a 5% threshold:

```rust
let time_s = self.params.time.value();
if (time_s - self.last_built_time_s).abs() > REBUILD_THRESHOLD {
    request_rebuild(time_s);
}
```

If that code used `.read()` instead, a single knob move would
crawl across the threshold over the smoother's ~200 ms ramp and
request a rebuild on every block until it settled — audible as an
unstable tail. The same principle applies to anything else gated
on "did the user actually change this?": filter mode switches,
voice-count changes, oversampling toggles wired through a float
param.

## Flags

`flags` is a `|`-separated combination of bit flags:

| Flag | Meaning |
|------|---------|
| `automatable` | Surfaces in the host's automation lane (default for non-bypass params). |
| `hidden` | Excluded from the host parameter list. Use sparingly — most hosts surface every exposed param. |
| `readonly` | Host can't write; GUI can't write either. For internal state you want serialized. |
| `bypass` | Marks the bypass parameter. Hosts treat this specially (per-track bypass UI). One per plugin. |

## Custom formatting

Most plugins get by with the default formatter chosen from `unit`. When you need conditional display — Hz vs. kHz, semitones, dotted-note durations — point `format` at a method on your params struct:

```rust
#[derive(Params)]
pub struct SynthParams {
    #[param(name = "Cutoff", range = "log(20, 20000)", unit = "Hz",
            format = "format_cutoff", parse = "parse_cutoff")]
    pub cutoff: FloatParam,
}

impl SynthParams {
    fn format_cutoff(&self, value: f64) -> String {
        if value >= 1000.0 {
            format!("{:.1} kHz", value / 1000.0)
        } else {
            format!("{:.0} Hz", value)
        }
    }

    fn parse_cutoff(&self, text: &str) -> Option<f64> {
        let t = text.trim().to_lowercase();
        if let Some(n) = t.strip_suffix("khz") {
            n.trim().parse::<f64>().ok().map(|v| v * 1000.0)
        } else {
            t.trim_end_matches("hz").trim().parse().ok()
        }
    }
}
```

`parse` is the inverse, used when the host accepts text input (Logic's "Type Value", REAPER's modify-value dialog, etc.).

## Nested structs

Split a wide parameter set into self-contained groups with `#[nested]`, each its own `#[derive(Params)]` struct. The host still sees one flat parameter list.

```rust
#[derive(Params)]
pub struct FilterParams {
    #[param(name = "Cutoff", group = "Filter", range = "log(20, 20000)", unit = "Hz")]
    pub cutoff: FloatParam,
    #[param(name = "Resonance", group = "Filter", range = "linear(0, 1)")]
    pub resonance: FloatParam,
}

#[derive(Params)]
pub struct PluginParams {
    #[nested] pub filter:   FilterParams,
    #[nested] pub envelope: EnvelopeParams,
}
```

A nested group's params **auto-number locally from 0**; you don't write ids inside the group. The parent rebases each group into the plugin's id space by a *base*: bare `#[nested]` auto-packs each group right after the preceding params (own params first, then each group in order). Above, `filter` lands at ids 0-1 and `envelope` follows.

### Reusing a group

Because the parent assigns the base, the **same group type can be nested more than once** without an id clash:

```rust
#[derive(Params)]
pub struct ChannelStrip {
    #[param(name = "Gain", range = "linear(-60, 12)", unit = "dB")]
    pub gain: FloatParam,
    #[param(name = "Mute")]
    pub mute: BoolParam,
}

#[derive(Params)]
pub struct UtilityParams {
    #[nested] pub left:  ChannelStrip,   // ids 0-1
    #[nested] pub right: ChannelStrip,   // ids 2-3
}
```

The two `ChannelStrip`s flatten to disjoint id ranges. (Their param *names* are shared, since they come from one type, so a host's flat list shows `Gain` twice; label them per-instance in your editor's sections.)

### Pinning a base for a group

Under the default (hash) id scheme, nested ids are already stable - a nested param's id is derived from its field name and its slot name, so reordering groups or inserting a param never shifts them (see [Parameter ID stability](#parameter-id-stability)). Pin a group's base with `#[nested(base = N)]` only when you want explicit numeric placement, or under the legacy `#[params(id_scheme = "ordinal")]` scheme where auto bases pack by order and do shift:

```rust
#[derive(Params)]
pub struct EqParams {
    #[nested(base = 0)] pub low:  LowBand,   // ids 0-2
    #[nested(base = 3)] pub mid:  MidBand,   // ids 3-5
    #[nested(base = 6)] pub high: HighBand,  // ids 6-8
    #[param(id = 9, name = "Output", range = "linear(-18, 18)", unit = "dB")]
    pub output: FloatParam,
}
```

The derive panics at construction if any two flattened ids collide, so a bad base is a loud failure, not silent state corruption.

### Addressing nested params in the editor

The generated `ParamId` enum (below) covers a struct's *own* params, not its nested children - the derive can't see inside another type. Reach a nested param by its runtime id off the field itself:

```rust
knob(self.params.filter.cutoff.id(), "Cutoff")
```

`.id()` returns the rebased (flattened) id, so it stays correct under reuse and pinning alike.

See the `synth` (distinct groups), `stereo-utility` (one group reused), and `eq` (pinned bases) examples for the three shapes.

> **Meters** can't live in a nested group that's used more than once - meter ids occupy a separate fixed range and aren't rebased, so two nested groups each declaring a meter collide (the derive rejects it at construction). Keep meters in a single, non-reused `Params` struct.

## Parameter ID stability

Every parameter has a numeric ID, and the host persists it as the stable handle for automation lanes and saved presets - it becomes the CLAP `clap_id`, the VST3 `ParamID`, and the key in truce's saved-state envelope. So a parameter's ID must not change between releases, or a user's saved session reloads with automation pointing at the wrong parameter.

truce keeps IDs stable for you by default. When you omit `#[param(id = N)]`, the derive assigns a **hash of the field name**. Reordering parameters, inserting a new one in the middle, or rearranging `#[nested]` groups all leave existing IDs put; only renaming a field (an explicit, reviewable edit) changes its ID. The same nested group type reused in two slots still gets distinct IDs, because each slot's name hashes differently.

You rarely need to think about IDs. The escape hatches:

- `#[param(id = N)]` pins one parameter to an exact value; an explicit ID always wins over the hash.
- If two field names happen to hash to the same value, the derive fails the build with a duplicate-ID error - pin one of them with `id = N`.

### Legacy ordinal scheme

Before the hash default, IDs were a counter from `0` in declaration order, so reordering shifted them. A plugin already shipped with those order-based IDs must keep them, or its users' saved sessions break on upgrade. Opt back in at the struct level:

```rust
#[derive(Params)]
#[params(id_scheme = "ordinal")]
pub struct MyParams { /* ... */ }
```

This restores the counter-from-0 assignment and the base-packed nesting exactly. New plugins should leave it off and use the hash default.

## Generated `ParamId` enum

The derive emits a `#[repr(u32)]` enum named `<StructName>ParamId` with one variant per parameter (and per meter). Use it everywhere you'd otherwise pass a raw u32:

```rust
use MyParamsParamId as P;

knob(P::Gain, "Gain");
slider(P::Pan, "Pan");
context.set_meter(P::MeterL, peak);
```

Typos become compile errors; rename-refactor stays safe.

## Shared ownership

The shell owns the `Arc<MyParams>` and passes a clone to `YourPlugin::new()`. GUI closures can also clone the `Arc`. Host automation writes atomically; every reader sees the latest value without locking.

```rust
pub struct MyPlugin {
    params: Arc<MyParams>,
}

impl MyPlugin {
    pub fn new(params: Arc<MyParams>) -> Self {
        Self { params }
    }
}
```

## Skipped fields (`#[skip]`)

A field marked `#[skip]` is **not a parameter** — it's plugin-owned state that lives in the params struct so both sides can reach it through the `Arc<MyParams>` they already share (see [Shared ownership](#shared-ownership)). The derive `Default`-initializes it in `new()` and excludes it from the parameter IDs, infos, saved state, and count, so it never appears as a host automation lane or in a preset. The field's type must implement `Default`.

Use it for non-automatable state the editor needs to reach directly: a shared atomic flag, decoded or cached data, or a lock-free queue of audio-thread events for a live visualiser. Because the audio thread (writer) and the editor (reader) both hold the same `Arc<MyParams>`, no separate channel is needed.

```rust
#[derive(Params)]
pub struct MyParams {
    #[param(name = "Gain", range = "linear(-60, 6)", unit = "dB")]
    pub gain: FloatParam,

    // Lock-free audio-thread -> editor channel. Not a parameter:
    // excluded from ids / state / count, default-initialised in `new()`.
    #[skip]
    pub events: Arc<EventRing>,
}
```

`process()` pushes into `events` (real-time safe — no locks or allocations), and the editor drains it each frame through the same `Arc` — the pattern the MIDI-inspector example uses to stream decoded events to its UI.
