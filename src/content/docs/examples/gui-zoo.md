# GUI Zoo

<img src="/screenshots/examples/gui-zoo.png" class="screenshot-hero" width="415" height="887" alt="gui-zoo plugin">

Passthrough plugin built around the built-in editor that exercises
every widget kind in one layout.

Source: [`examples/truce-example-gui-zoo/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-gui-zoo).

## What it demonstrates

- Every built-in `GridLayout` widget in one editor
- Auto-flow placement mixed with explicit `.at(col, row)` positioning
- Cell spans across both axes

Mirrored across four other GUI backends -
[gui-zoo-egui](./gui-zoo-egui),
[gui-zoo-iced](./gui-zoo-iced),
[gui-zoo-slint](./gui-zoo-slint),
and [gui-zoo-vizia](./gui-zoo-vizia) - same param set, different
renderer.
