# EQ

<img src="/screenshots/examples/eq.png" class="screenshot-hero" width="208" height="362" alt="eq plugin">

3-band parametric equalizer using biquad filters.

Source: [`examples/truce-example-eq/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-eq).

## What it demonstrates

- Biquad filter DSP (Direct Form II Transposed)
- Per-sample coefficient updates from smoothed parameters
- Logarithmic parameter ranges for frequency and Q
- Section-based grid layout (`LOW`, `MID`, `HIGH`)
- Auto-bypass when band gain is near 0 dB
- **`f64` end-to-end** via `use truce::prelude64::*` — biquad
  coefficient computation is precision-sensitive (especially at
  low Q × low frequency). On formats with a 64-bit wire (VST3,
  VST2, CLAP) the plugin processes the host's `f64` buffers
  directly; elsewhere the wrapper widens host `f32` at the block
  boundary so the DSP path stays in `f64` either way.
- **Legacy state migration** — the reference `migrate_state`
  implementation: a pre-truce `EQS1` blob translates into truce
  params, tested with `assert_state_migration` (and
  `assert_state_migration_rejected` for blobs the plugin must
  refuse). See the
  [state guide](../guide/state.md#migrating-state-from-a-pre-truce-build).

## Parameters

| Name | Range | Unit | Description |
|------|-------|------|-------------|
| Low Freq | 20 to 1000 | Hz | Low band center frequency |
| Low Gain | -18 to +18 | dB | Low band boost/cut |
| Low Q | 0.1 to 10 | -- | Low band width |
| Mid Freq | 200 to 8000 | Hz | Mid band center frequency |
| Mid Gain | -18 to +18 | dB | Mid band boost/cut |
| Mid Q | 0.1 to 10 | -- | Mid band width |
| High Freq | 1000 to 20000 | Hz | High band center frequency |
| High Gain | -18 to +18 | dB | High band boost/cut |
| High Q | 0.1 to 10 | -- | High band width |
| Output | -18 to +18 | dB | Output trim |

## Files

- `src/lib.rs` — plugin logic, GUI layout with sections
- `src/biquad.rs` — standalone biquad filter implementation

## Build and test

```bash
cargo build -p truce-example-eq
cargo test -p truce-example-eq
```
