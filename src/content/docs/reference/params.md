# `#[derive(Params)]` reference

Every attribute, range type, smoothing mode, and parameter type that the params derive accepts. For a narrative tour and recipes, see the [parameters chapter in the guide](../guide/parameters.md).

## `#[param(...)]` attribute keys

| Key | Example | Notes |
|-----|---------|-------|
| `id` | `id = 0` | Optional. Auto-assigned by field order if omitted. **Stable across releases — never change.** Required when nesting structs to avoid 0/1/2/… collisions. |
| `name` | `name = "Gain"` | **Required.** Display name in host and GUI. |
| `short_name` | `short_name = "Gn"` | Abbreviated name for narrow strips. Defaults to `name`. |
| `range` | `range = "linear(-60, 6)"` | Value mapping. Inferred for `BoolParam` and `EnumParam<T>`. |
| `default` | `default = 0.0` | Default value in plain units. Defaults to range min. |
| `unit` | `unit = "dB"` | Display unit. Shapes the default formatter. Valid: `dB`, `Hz`, `ms`, `s`, `%`, `pan`, `st`. |
| `smooth` | `smooth = "exp(5)"` | Smoothing style + time in ms. See [Smoothing](#smoothing). |
| `group` | `group = "Filter"` | Parameter group surfaced by the host (CLAP module path / VST3 unit / AU group). |
| `flags` | `flags = "automatable \| bypass"` | Combination of: `automatable`, `hidden`, `readonly`, `bypass`. |
| `format` | `format = "format_cutoff"` | Method on the params struct that converts a `f64` value to a `String`. |
| `parse` | `parse = "parse_cutoff"` | Inverse of `format`. Method that parses a host text-input `&str` back to `f64`. |

The derive generates `MyParams::new()`, a `Default` impl, the full `Params` trait impl, and a typed `MyParamsParamId` enum (`#[repr(u32)]`) with one variant per parameter.

## Parameter types

| Field type | Default widget | Notes |
|------------|----------------|-------|
| `FloatParam` | knob | Continuous. Supports smoothing and custom formatting. |
| `BoolParam` | toggle | On / off. Range is implicit `0..1` — don't pass `range`. |
| `IntParam` | knob | Integer steps within a range. |
| `EnumParam<T>` | selector | Click-to-cycle. `T` is a `#[derive(ParamEnum)]` enum; range is inferred from the variant count. |
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

Parameters and meters share the generated `ParamId` enum. Write from `process()`, read in `layout()`:

```rust
// process():
context.set_meter(P::MeterL, buffer.output_peak(0));
context.set_meter(P::MeterR, buffer.output_peak(1));

// layout():
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

In `process()`, pull a smoothed value per sample with `smoothed_next()`:

```rust
let g = self.params.gain.smoothed_next();
```

Smoother methods take `&self` (atomics inside), so they work through `Arc<Params>` without `&mut`.

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

Split a wide parameter set into sub-structs with `#[nested]`:

```rust
#[derive(Params)]
pub struct PluginParams {
    #[nested] pub filter:   FilterParams,
    #[nested] pub envelope: EnvelopeParams,
}

#[derive(Params)]
pub struct FilterParams {
    #[param(id = 10, name = "Cutoff", group = "Filter",
            range = "log(20, 20000)", unit = "Hz")]
    pub cutoff: FloatParam,
}
```

**Assign explicit `id` values when nesting.** Auto-IDs are per-struct, so without `id =` the nested structs collide at 0, 1, 2, ... Pick a non-overlapping ID block per struct (10–19 for filter, 20–29 for envelope, etc.). Nested params are flattened for the host — it sees one list.

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
