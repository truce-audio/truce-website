# Block Dry/Wet

<img src="/screenshots/examples/block-drywet.png" style="max-width: 400px; max-height: 300px;" alt="block-drywet plugin">

Parallel-saturation dry/wet plugin. Wet path is a `tanh_block`
soft-clip after a drive boost; dry and wet blend through
`mix_block` at the user ratio.

Source: [`examples/truce-example-block-drywet/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-drywet).

## What it demonstrates

- `truce_simd::ops::mix_block` as a dry/wet cross-fader (its
  canonical use case; no other example calls it).
- `truce_simd::math::tanh_block` as the wet-shaping transform.
- Scalar-per-call mix coefficients: read the smoothed `mix` value
  once per block (zero-order hold within the block; the smoother
  bridges block-to-block transitions).

## Parameters

| Name | Range | Unit | Default |
|------|-------|------|---------|
| Drive | 0 to 24 | dB | 6.0 |
| Mix | 0 to 1 | % | 0.5 |

## Build and test

```bash
cargo build -p truce-example-block-drywet
cargo test -p truce-example-block-drywet
cargo truce install -p truce-example-block-drywet
```
