# 4. Parameters

Declare your plugin's knobs, switches, and meters in one struct.
`#[derive(Params)]` plus `#[param(...)]` attributes generate the
plumbing — storage, host-visible IDs, a typed enum, display
formatting, and smoothing.

## The basic shape

```rust
use truce::prelude::*;

#[derive(Params)]
pub struct MyParams {
    #[param(name = "Gain", range = "linear(-60, 6)",
            unit = "dB", smooth = "exp(5)")]
    pub gain: FloatParam,

    #[param(name = "Pan", range = "linear(-1, 1)",
            unit = "pan", smooth = "exp(5)")]
    pub pan: FloatParam,

    #[param(name = "Bypass", flags = "automatable | bypass")]
    pub bypass: BoolParam,
}
```

The derive generates:

- `MyParams::new()` and a `Default` impl.
- A full `Params` trait impl (count, IDs, formatting, smoothing,
  state collection).
- A `MyParamsParamId` enum (`#[repr(u32)]`) with one variant per
  parameter: `Gain = 0`, `Pan = 1`, `Bypass = 2` — typed IDs you
  can pass to the GUI layout and to `context.set_meter`.

IDs auto-assign from field order. If you need to rename a field
after release, **keep the same `id`** — change the name, not the
ID, or host automation and saved presets break.

## Typed IDs in practice

Alias the generated enum once and reuse it:

```rust
use MyParamsParamId as P;

// GUI layout:
knob(P::Gain, "Gain");
slider(P::Pan, "Pan");
toggle(P::Bypass, "Bypass");

// Meters:
context.set_meter(P::MeterL, buffer.output_peak(0));
```

Typos are compile errors. Rename-refactor is safe.

## Parameter types

| Field type | Widget default | Notes |
|------------|----------------|-------|
| `FloatParam` | knob | Continuous. Supports smoothing and custom formatting. |
| `BoolParam` | toggle | On / off. Auto-detected as a toggle widget. |
| `IntParam` | knob | Integer steps within a range. |
| `EnumParam<T>` | dropdown | Click-to-open list; `T` is a `#[derive(ParamEnum)]` enum. |
| `MeterSlot` | meter | Read-only, written from `process()`, drawn by the GUI. |

### Enum parameters

```rust
#[derive(ParamEnum)]
pub enum Waveform { Sine, Saw, Square, Triangle }

#[param(name = "Waveform")]
pub waveform: EnumParam<Waveform>,
```

The range is inferred from the variant count — don't pass
`range`. Use `#[name = "..."]` on a variant to override its display
text (`#[name = "Up/Down"] UpDown` → displays as `"Up/Down"`, the
Rust name stays `UpDown`).

### Meters

Meters are not parameters — they flow audio-thread → UI-thread
instead of host → plugin. Declare them as `MeterSlot` fields with
`#[meter]`:

```rust
#[derive(Params)]
pub struct MyParams {
    #[param(name = "Gain", range = "linear(-60, 6)",
            unit = "dB", smooth = "exp(5)")]
    pub gain: FloatParam,

    #[meter] pub meter_l: MeterSlot,
    #[meter] pub meter_r: MeterSlot,
}
```

Parameters and meters share the generated `ParamId` enum —
`P::Gain`, `P::MeterL`, `P::MeterR` all work. Use those typed
identifiers; the derive keeps the underlying IDs collision-free.

Write from `process()`, draw in `editor()`:

```rust
// process():
context.set_meter(P::MeterL, buffer.output_peak(0));
context.set_meter(P::MeterR, buffer.output_peak(1));

// editor():
meter(&[P::MeterL, P::MeterR], "Level").rows(3)
```

The write is realtime-safe (atomic); the GUI reads the latest
value every frame.

## Attribute reference

Every key that `#[param(...)]` accepts — `id`, `range`, `unit`, `smooth`, `flags`, custom `format` / `parse`, and the rest — is in the dedicated [params reference](../reference/params.md). Skim that page when you're looking up syntax; this chapter focuses on patterns.

## Smoothing

Host automation usually arrives block-rate. Smoothing
interpolates between successive target values so there's no zipper
noise on continuous parameters.

```
smooth = "none"            // instant jump. Right for toggles, enums, voice counts.
smooth = "linear(20)"      // linear ramp over 20 ms. Right for pan and mix.
smooth = "exp(5)"          // exponential one-pole, 5 ms. Right for gain and filter cutoff.
```

Call `params.set_sample_rate(sr)` + `params.snap_smoothers()` in
`reset()`. Pull a smoothed value per sample with `.read()` —
the return type (f32 or f64) follows your prelude choice; see
[Precision (preludes)](plugin-anatomy.md#precision-preludes).

```rust
fn reset(&mut self, sample_rate: f64, _: usize) {
    self.params.set_sample_rate(sample_rate);
    self.params.snap_smoothers();
}

fn process(&mut self, buffer: &mut AudioBuffer, _: &EventList,
           _: &mut ProcessContext) -> ProcessStatus {
    for i in 0..buffer.num_samples() {
        let g = self.params.gain.read();
        // ...
    }
    ProcessStatus::Normal
}
```

`.read()` takes `&self` (the atomic smoother state is interior-
mutable), so it works through `Arc<Params>` without `&mut`.

## Sample-accurate automation

When the host sends a parameter change mid-block, the smoother
starts ramping from the event's `sample_offset` rather than from the
top of the block. truce achieves this by chunking `process()` at
event boundaries: each `EventBody::ParamChange` whose target
parameter participates in chunking splits the audio block, and the
smoother's `set_target` runs at the sub-block boundary instead of
eagerly at block start.

The behavior is on by default for every parameter. Plugins reading
`.read()` per sample get sample-accurate behavior for free —
smoothers ramp from the right sample, `SmoothingStyle::None` params
snap at the right sample.

### Tuning the granularity

The chunker has one global knob — the **minimum sub-block size**.
Events that would produce a sub-block shorter than this are
coalesced (the smoother target is set at the start of the next
sub-block instead of at the event sample). Set it in
[`truce.toml`](../reference/truce-toml.md):

```toml
[automation]
min_subblock_samples = 32   # default
```

- **32** (default) — sub-blocks land on SIMD-friendly strides;
  per-event fixed costs in `process()` are bounded to
  `block_size / 32`. Good fit for typical plugins.
- **1** — strict sample-accuracy. Pick when an event landing one
  sample early would matter (transient shapers, hard-cut volume
  automation).
- **N where N ≥ host max block size** — disables chunking; matches
  the pre-0.52 "apply at block start" behavior. Pick when the
  whole `process()` body is too expensive to subdivide and a
  per-param opt-out (below) doesn't cover enough.

### Per-parameter opt-out

Some parameters are too expensive to re-target mid-block — FFT
sizes, lookahead lengths, filter rebuild triggers. Mark them with
`chunk = false` so their events never trigger a split (the change
still applies, just at the start of the next sub-block, like before
0.52):

```rust
#[derive(Params)]
pub struct MyParams {
    // Cheap to re-target — sub-block chunks at every event.
    #[param(name = "Cutoff", range = "log(20, 20000)", smooth = "exp(10)")]
    pub cutoff: FloatParam,

    // FFT size triggers a buffer rebuild — too expensive to chunk on.
    #[param(name = "FFT Size", range = "discrete(256, 4096)",
            chunk = false)]
    pub fft_size: IntParam,
}
```

This lets the cheap params get sample-accurate behavior without
paying per-event FFT rebuilds.

### What plugin code sees

`process()` itself doesn't change. The plugin receives a `&mut
AudioBuffer` of the sub-block length and an `&EventList` whose
entries have `sample_offset` rebased to the sub-block. Each
sub-block is a normal `process()` call — same `AudioBuffer` shape,
same `EventList` API, same `ProcessContext`.

Plugins that already implemented the manual event-splitting loop
(see [processing § Sample-accurate event splitting](processing.md#sample-accurate-event-splitting))
keep working.

### Per-format coverage

- **CLAP, VST3, AU v3, LV2** — full sample-accurate automation. AU
  v3 decodes `AURenderEvent.parameter` / `.parameterRamp` into
  per-sample `ParamChange` events; LV2 advertises each parameter
  as a `patch:writable` property and decodes host-emitted
  `patch:Set` Objects from the input atom sequence (the atom
  event's `time_frames` becomes the within-block `sample_offset`).
  Ramps are treated as a step at the event's sample (the plugin's
  smoother handles the actual interpolation), matching VST3's
  parameter-queue treatment. The legacy `lv2:ControlPort` path is
  kept alongside so older LV2 hosts still update params at block
  rate.
- **AU v2, VST2, AAX Native** — the format's host→plugin parameter
  delivery has no sample-offset slot (`AudioUnitSetParameter`,
  `effSetParameter`, AAX's `inSynchronizedParamValues`), so
  block-rate is the contract. AAX DSP (Pro Tools | HDX) has
  per-chunk delivery on a 32-sample grid; truce doesn't target
  that path.
- **Standalone** — GUI gestures always arrive at `sample_offset = 0`,
  so the chunker is a no-op.

## Shared ownership (`Arc<Params>`)

The shell owns the `Arc<MyParams>` and passes a clone to
`YourPlugin::new()`. GUI closures can also clone the `Arc`. Host
automation writes atomically; every reader sees the latest value
without locking.

```rust
pub struct MyPlugin {
    params: Arc<MyParams>,
}

impl MyPlugin {
    pub fn new(params: Arc<MyParams>) -> Self { Self { params } }
}
```

---

Groups, nested structs, and custom formatting (`format` / `parse` methods) are documented in the [params reference](../reference/params.md).

## What's next

- **[Chapter 5 → processing](processing.md)** — put these
  parameters to work in `process()`.
- **[Chapter 8 → gui](gui.md)** — wire parameters into widgets
  via typed `ParamId`s.
