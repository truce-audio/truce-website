# Gain (egui, aspect-locked)

<img src="/screenshots/examples/gain-egui-aspect.png" class="screenshot-hero" width="200" height="300" alt="gain-egui-aspect plugin">

The egui gain example with a 2:3 aspect-ratio lock: the editor
advertises the ratio so the host keeps width and height
proportional on every resize edge.

Source: [`examples/truce-example-gain-egui-aspect/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-gain-egui-aspect).

## What it demonstrates

- The `EguiEditor` builder: `.resizable(true)`, `.min_size(..)`,
  `.max_size(..)`, and `.aspect_ratio(Some((2, 3)))`, with the
  window size and both bounds sitting exactly on 2:3 so the lock
  holds across the whole range
- Aspect-lock host coverage: honored by CLAP, VST3, AU v3, LV2,
  and the standalone host; VST2 and AAX ignore it
- `truce_egui::widgets`: `param_knob`, a two-axis `param_xy_pad`
  bound to Pan and Gain, and a stereo `level_meter`
- `#[meter]` `MeterSlot` fields fed from `process()` via
  `context.set_meter(..)` and `buffer.output_peak(ch)`
- Editor theming with `truce_egui::theme::dark()` and
  `.with_font(JETBRAINS_MONO)`
- Constant-power-style pan law layered on smoothed dB gain
  (`smooth = "exp(5)"`, `db_to_linear`)

## Parameters

| Name | Range | Unit |
|------|-------|------|
| Gain | -60 to +6 | dB |
| Pan | -1 to +1 | pan |

Two meter slots (left/right output peak) feed the level meter;
they are display-only, not automatable parameters.

## Build and test

```bash
cargo build -p truce-example-gain-egui-aspect
cargo test -p truce-example-gain-egui-aspect
```
