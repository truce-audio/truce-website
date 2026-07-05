# Gain (iced)

<img src="/screenshots/examples/gain-iced.png" class="screenshot-hero" width="176" height="290" alt="gain-iced plugin">

The gain plugin reimplemented with an
[iced](https://github.com/iced-rs/iced) GUI. Same DSP as the
built-in [gain](./gain) example, different frontend.

Source: [`examples/truce-example-gain-iced/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-gain-iced).

## What it demonstrates

- `IcedPlugin` trait with custom `view()` method
- `knob`, `xy_pad`, `meter` canvas widgets with `.el()` shorthand
- `IntoElement` trait for clean iced layout code
- Custom header using `iced::widget::container` with styled
  background
- Default `update()` (no custom messages needed for this simple UI)
- Consistent window sizing with `WINDOW_W`/`WINDOW_H` constants
- Screenshot testing with `truce_iced::screenshot`

## Layout

Header bar with plugin name. Left column with two knobs (Gain,
Pan) and an XY pad. Thin stereo meter spanning the full height on
the right.

## See also

- [iced integration guide](../guide/gui/iced)
- [gain](./gain) — same plugin with the built-in GUI
- [gain-egui](./gain-egui) — same plugin with egui
- [gain-slint](./gain-slint) — same plugin with slint
- [gain-vizia](./gain-vizia) — same plugin with vizia (desktop only)
