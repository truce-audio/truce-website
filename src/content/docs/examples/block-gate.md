# Block Gate

<img src="/screenshots/examples/block-gate.png" class="screenshot-hero" width="139" height="113" alt="block-gate plugin">

Noise gate: passes audio through when the block peak is above
threshold, zeroes the output when below. Per-block detect and
apply (hard gate, zero ramp) to keep the example focused on the
two SIMD ops it exists to demo.

Source: [`examples/truce-example-block-gate/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-gate).

## What it demonstrates

- `truce_simd::ops::abs_max_block` for the per-channel peak
  detection in the detect stage.
- `truce_simd::ops::zero_block` for the fast silence path in
  the apply stage.

For a production gate you'd add an attack/release envelope (a
per-sample 0..1 ramp applied via `mul_block`); see
[`block-gain`](./block-gain) for the envelope shape. Stripped
here to keep the diff tight.

## Parameters

| Name | Range | Unit | Default |
|------|-------|------|---------|
| Threshold | -80 to 0 | dB | -40.0 |
