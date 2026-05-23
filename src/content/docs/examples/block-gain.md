# Block Gain

<img src="/screenshots/examples/block-gain.png" class="screenshot-hero" width="208" height="251" alt="block-gain plugin">

Fully SIMD-optimized gain plugin: block-rate processing plus a
vectorized envelope precompute for the slow-path smoothing case.

Source: [`examples/truce-example-block-gain/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-gain).

## What it demonstrates

- Fast path on converged smoothers (`is_smoothing() == false`)
  vs. slow path during active smoothing.
- `truce_simd::math::db_to_linear_block` for the slow-path
  envelope precompute. With many smoothed gain knobs in flight,
  this closes the gap between block-rate and the pre-vectorization
  scalar baseline.
- Trade-off: one extra `[f32; MAX_BLOCK]` stack scratch and one
  extra pass over the envelope. Net win measurable when N
  smoothers ≥ ~4.

## Parameters

| Name | Range | Unit |
|------|-------|------|
| Gain | -60 to +6 | dB |
| Pan | -1 to +1 | pan |

## Build and test

```bash
cargo build -p truce-example-block-gain
cargo test -p truce-example-block-gain
cargo truce install -p truce-example-block-gain
```
