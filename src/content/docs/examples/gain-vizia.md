# Gain (vizia)

<img src="/screenshots/examples/gain-vizia.png" class="screenshot-hero" width="176" height="260" alt="gain-vizia plugin">

The gain plugin reimplemented with a
[Vizia](https://github.com/vizia/vizia) GUI. Same DSP as the
built-in [gain](./gain) example, different frontend.

Source: [`crates/truce-vizia/examples/truce-example-gain-vizia/`](https://github.com/truce-audio/truce/tree/main/crates/truce-vizia/examples/truce-example-gain-vizia).

## What it demonstrates

- `ViziaEditor` with a setup closure receiving `&mut Context` +
  `ParamLens<P>`
- `param_knob`, `param_xy_pad`, `level_meter` widget helpers
- Shared `Signal<f32>` per param — knob and XY pad bound to the
  same `id` stay in sync without extra wiring
- Per-OS screenshot baselines with `pixel_threshold(2)` on Linux
  and Windows (rasterizer drift)
- `with_stylesheet(widgets::BASE_CSS)` for vizia layout shims
- `with_font(JETBRAINS_MONO)` for cross-backend visual parity

## Layout

Left column: two knobs (Gain, Pan) over a 130×130 Pan/Gain XY pad.
Right column: stereo meter spanning the full height. 176×260 logical
points, aligned so the XY pad's bottom edge matches the meter's.

## Files

- `src/lib.rs` — plugin logic, editor wiring, screenshot tests
- `src/main.rs` — standalone host entry point

## See also

- [vizia integration guide](../guide/gui/vizia)
- [gain](./gain) — same plugin with the built-in GUI
- [gain-egui](./gain-egui) — same plugin with egui
- [gain-iced](./gain-iced) — same plugin with iced
- [gain-slint](./gain-slint) — same plugin with slint
