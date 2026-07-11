# Sidechain

<img src="/screenshots/examples/sidechain.png" class="screenshot-hero" width="208" height="182" alt="sidechain plugin">

Reference for wiring a separate sidechain input bus. Declares a
stereo **Main** input, a stereo **Sidechain** input, and a stereo
output; meters both input levels and blends them with a **Mix**
knob, so the routing is easy to verify by eye (the meters) and ear
(the blend).

Source: [`examples/truce-example-sidechain/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-sidechain).

## What it demonstrates

- `BusLayout::with_sidechain_input` to declare a second input bus
  the host surfaces as a real sidechain (a `kBusType_Aux` bus on
  VST3, a CLAP `is_sidechain` port, extra VST2 pins, Pro Tools'
  mono side-chain on AAX)
- Flat channel indexing across buses: `input(0)`/`(1)` is main L/R,
  `input(2)`/`(3)` is sidechain L/R, in declaration order
- Detecting an unconnected sidechain with
  `buffer.num_input_channels()` and gating the reads (the wrapper
  hands unconnected sidechain channels silence, so it never panics)
- `buffer.io_pair(in_ch, out_ch)` to read one input channel while
  writing one output channel in the same loop
- Block-constant smoothing with `read_after(buffer.num_samples())`,
  which advances the `exp(10)` smoother across the whole block so
  the blend settles in ~10 ms rather than ~10 blocks
- Metering both buses into `MeterSlot`s drawn side by side in the
  built-in `GridLayout` editor

## Parameters

| Name | Range | Unit |
|------|-------|------|
| Mix | 0 to 1 (default 0) | % |

At Mix 0 you hear the main input; at 1, the sidechain.

## Testing the routing

Without a host, drive the sidechain from a file with the standalone
runner: `--sidechain-file <path>`, independent of the main
`--input-file` (see [standalone](../formats/standalone.md)). In a DAW,
route another track into the plugin's sidechain bus and watch the SC
meter follow it.
