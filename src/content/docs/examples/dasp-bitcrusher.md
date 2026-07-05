# dasp Bitcrusher

<img src="/screenshots/examples/dasp-bitcrusher.png" class="screenshot-hero" width="208" height="113" alt="dasp-bitcrusher plugin">

Bitcrusher with bit-depth reduction, sample-and-hold rate
reduction, and a dry/wet mix. Shows how to integrate a third-party
DSP crate (dasp) into a truce plugin.

Source: [`examples/truce-example-dasp-bitcrusher/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-dasp-bitcrusher).

## What it demonstrates

- Third-party DSP crate integration: quantization routes through
  `dasp_sample::Sample` (`to_sample::<i8>()` / `to_sample::<i16>()`)
  for the depths dasp ships as concrete types, with a
  floor-quantize fallback for the rest
- `IntParam` with `discrete(..)` ranges and the boundary-read
  helpers (`value_usize`)
- Per-channel sample-and-hold state (`held`, `hold_counter`) reset
  in `reset()` and carried across blocks
- Built-in `GridLayout` editor: three `knob` widgets addressed by
  the derived `ParamId` enum
- Driver-based passthrough test (`driver!` with
  `InputSource::Constant`) plus per-OS `screenshot!` baselines

## Parameters

| Name | Range | Unit |
|------|-------|------|
| Bits | 2 to 16 (discrete, default 16) | bits |
| Hold | 1 to 32 (discrete, default 1) | samples |
| Mix | 0 to 1 (default 1.0) | % |
