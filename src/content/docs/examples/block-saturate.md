# Block Saturate

Series saturator: drive → `tanh` soft-clip → make-up gain.
Demonstrates composing `ops::*` and `math::*` through scratch
buffers when the chain has more than one stage.

Source: [`examples/truce-example-block-saturate/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-saturate).

## What it demonstrates

- `truce_simd::math::tanh_block` in series with two gain stages.
- Fast path (smoothers converged): scalar drive / output linear
  constants, two `gain_block` calls around a single `tanh_block`.
- Slow path (smoothing in progress): vectorize the dB → linear
  envelope via `math::db_to_linear_block`, then apply the chain
  per channel via `mul_block` (per-sample envelope) instead of
  `gain_block` (scalar).

## Parameters

| Name | Range | Unit | Default |
|------|-------|------|---------|
| Drive | 0 to 36 | dB | 6.0 |
| Output | -24 to +6 | dB | 0.0 |

## Build and test

```bash
cargo build -p truce-example-block-saturate
cargo test -p truce-example-block-saturate
cargo truce install -p truce-example-block-saturate
```
