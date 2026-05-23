# Block Surround Meter

<img src="/screenshots/examples/block-surround-meter.png" class="screenshot-hero" width="70" height="251" alt="block-surround-meter plugin">

5.1 surround pass-through with per-channel dB-scale meters.
Demos [`truce_simd::math::linear_to_db_block`] on an array of
per-channel peaks converted all at once. For one or two peaks
a scalar `20 * log10(x)` is cheaper; the SIMD form starts
winning around 4+ elements, which 5.1 (L, R, C, LFE, Ls, Rs)
gives us exactly.

Source: [`examples/truce-example-block-surround-meter/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-block-surround-meter).

## What it demonstrates

- Non-stereo `bus_layouts()` override. Advertises both stereo
  and 5.1 so the plugin loads in DAWs without surround support;
  channels beyond the host-selected layout's count are not
  touched.
- Per block: trim each channel (`gain_block`), find linear peak
  (`abs_max_block`), convert the peak array to dB in one SIMD
  call (`linear_to_db_block`), then clamp / re-normalise to
  `[0, 1]` for the meter widget.
- Linear meter on a logarithmic dB scale — the perceptually
  correct visual.

## Parameters

| Name | Range | Unit | Default |
|------|-------|------|---------|
| Trim | -24 to +24 | dB | 0.0 |

## Build and test

```bash
cargo build -p truce-example-block-surround-meter
cargo test -p truce-example-block-surround-meter
cargo truce install -p truce-example-block-surround-meter
```
