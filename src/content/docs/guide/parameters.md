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
| `EnumParam<T>` | selector | Click-to-cycle; `T` is a `#[derive(ParamEnum)]` enum. |
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

Write from `process()`, draw in `layout()`:

```rust
// process():
context.set_meter(P::MeterL, buffer.output_peak(0));
context.set_meter(P::MeterR, buffer.output_peak(1));

// layout():
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
