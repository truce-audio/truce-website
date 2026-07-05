# CC Filter

<img src="/screenshots/examples/cc-filter.png" class="screenshot-hero" width="139" height="113" alt="cc filter plugin">

One-pole low-pass filter whose cutoff is steered by an incoming
MIDI CC (default CC74, the standard "brightness" controller).

Source: [`examples/truce-example-cc-filter/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-cc-filter).

## What it demonstrates

- Audio effect that consumes MIDI (`midi_input = true` in
  `truce.toml`; on AU this registers the component as an `aumf`
  MusicEffect so hosts actually route MIDI to it)
- Handling `EventBody::ControlChange` events in `process()` to
  steer DSP state
- Declarative host MIDI mapping via `midi_cc = 74` on a
  `#[param(...)]` attribute
- Logarithmic parameter range (`range = "log(20, 20000)"`) with
  exponential smoothing (`smooth = "exp(10)"`)
- f64 DSP state (per-channel one-pole `z1`) cast to f32 only at
  the output boundary

## Parameters

| Name | Range | Unit | Description |
|------|-------|------|-------------|
| Cutoff | 20 to 20000 (log) | Hz | Cutoff used before any CC arrives; incoming CC overrides it |
| CC | 0 to 127 | -- | CC number that steers the cutoff |

## Build and test

```bash
cargo build -p truce-example-cc-filter
cargo test -p truce-example-cc-filter
```
