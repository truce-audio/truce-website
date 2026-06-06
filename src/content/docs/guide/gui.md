# 8. GUI

truce ships a built-in GUI designed for audio plugins. You
declare a layout — rows of widgets — and the framework draws it,
routes input events, and keeps everything in sync with the
parameter `Arc`. Zero pixel math.

If that's not enough, truce has adapters for egui, iced, Slint, and
Vizia, plus a raw-window-handle escape hatch for anything else.
Start with the built-in and reach for a framework when you hit its
limits.

## The built-in GUI

### Declaring a layout

```rust
use truce_gui::IntoLayoutEditor;
use truce_gui_types::layout::{GridLayout, knob, slider, toggle,
                        dropdown, meter, xy_pad, widgets, section};
use MyParamsParamId as P;

impl PluginLogic for MyPlugin {
    // ... reset, process ...

    fn editor(&self) -> Box<dyn Editor> {
        GridLayout::build(vec![
            widgets(vec![
                knob(P::Gain, "Gain"),
                knob(P::Pan,  "Pan"),
                toggle(P::Bypass, "Bypass"),
            ]),
            section("FILTER", vec![
                knob(P::Cutoff,    "Cutoff"),
                knob(P::Resonance, "Reso"),
            ]),
        ])
        .into_editor(&self.params)
    }
}
```

`GridLayout::build(sections)` — each section is either a
`widgets(vec![...])` row or a labelled `section("NAME", vec![...])`
group. Widgets flow left-to-right; use `.cols(n)` / `.rows(n)` to
span cells. By default there's no header, `cols` resolves to the
widest section's widget count, and the cell size is 50 logical
points. Override any of those:

- `.with_title("MY PLUGIN")` — adds a header band with a title only.
- `.with_subtitle("v0.1")` — header band with the right-aligned
  subtitle slot only.
- `.with_titles(HeaderTitles::pair("MY PLUGIN", "v0.1"))` — both
  slots at once. `HeaderTitles::title(...)` / `::subtitle(...)` /
  `::pair(...)` / `::none()` cover every combination.
- `.with_cols(n)` — force a specific column count (useful to wrap a
  long row into a grid).
- `.with_cell_size(s)` — bigger / smaller cells.
- `.with_grid(cols, cell_size)` — both at once.

### The seven widgets

| Constructor | Widget | Typical use |
|-------------|--------|-------------|
| `knob(P::X, "Label")` | rotary | gain, cutoff, resonance, any `FloatParam` |
| `slider(P::X, "Label")` | linear slider | pan, mix, sometimes easier to read than a knob |
| `toggle(P::X, "Label")` | pill on/off | `BoolParam`, bypass |
| `dropdown(P::X, "Label")` | click-to-open list | `EnumParam<T>` / `IntParam` |
| `meter(&[P::L, P::R], "Label")` | vertical level meters | peak / RMS output |
| `xy_pad(P::X, P::Y, "Label")` | 2-axis pad | two continuous params on one surface |

> `selector(P::X, "Label")` is deprecated since 0.56.0; use
> `dropdown` instead.

### Spanning cells

```rust
knob(P::Gain, "Gain"),                          // 1×1 cell (default)
dropdown(P::Wave, "Wave").cols(2),              // 2 cells wide
meter(&[P::L, P::R], "Level").rows(3),          // 3 cells tall
xy_pad(P::X, P::Y, "Pad").cols(2).rows(2),      // 2×2 cell block
```

Explicit positions work too: `knob(P::Gain, "Gain").at(col, row)`.

### Meters

Declare meters as `#[meter] pub x: MeterSlot` fields alongside your
params (see [parameters.md § Meters](parameters.md#meters)), push
from `process()` with `context.set_meter(P::MeterL, peak)`, and
render them in `editor()`:

```rust
meter(&[P::MeterL, P::MeterR], "Level").rows(3)
```

The DSP side is atomic and realtime-safe. The GUI reads the latest
value every frame.

### Interaction for free

- Drag on a knob / slider → change the param.
- Scroll-wheel on a knob → fine-tune.
- Double-click a knob → reset to default.
- Click a toggle / dropdown → set / open.
- Right-click a widget → host context menu (automation, reset,
  enter value).

You don't write any of this. The framework knows the widget kind
from the layout and the parameter behaviour from the `ParamId`.

### Rendering and theming

The built-in GUI rasterises on the CPU through tiny-skia by
default. Opt into GPU rendering (wgpu → Metal on macOS, DX12 on
Windows, Vulkan on Linux) with the `gpu` feature on `truce-gui`.

Colours come from a named theme — dark by default. Swap to light or
a custom palette:

```rust
GridLayout::build(sections)
    .with_title("MY PLUGIN")
    .theme(truce_gui_types::theme::Theme::light())
```

Text renders via fontdue with JetBrains Mono Regular embedded at
compile time — no font file on disk, no runtime load.

See the [built-in GUI reference](gui/built-in.md) for every
widget constructor, cell-spanning option, and theming detail.

## Alternatives

The built-in GUI covers knobs / sliders / meters / dropdowns —
the common audio-plugin shape. Reach for an alternative backend
when you need:

- **Text input fields** beyond the built-in value pop-in.
- **Lists or tables** (preset browsers, modulation matrices, sample
  browsers).
- **Custom graphics** — analyzer curves, waveforms, drawable
  envelopes.
- **Specific aesthetics** the built-in theme system can't reach.

All alternatives integrate the same way: return the backend's
editor from `editor()` on `PluginLogic`, finishing the builder
chain with `.into_editor()`.

| Backend | Crate | When |
|---------|-------|------|
| **egui** | `truce-egui` | Immediate-mode. Good for prototyping, CPU-graph-heavy debugging UIs, and dev tools. Full guide: [gui/egui](gui/egui.md). |
| **iced** | `truce-iced` | Retained-mode with Elm architecture. Good for complex custom UIs where you want a proper widget tree and state machine. Auto-generated from `GridLayout` is also available. [gui/iced](gui/iced.md). |
| **Slint** | `truce-slint` | Declarative markup (`.slint` files) with data binding. Good for visually rich UIs designed outside Rust. [gui/slint](gui/slint.md). |
| **Vizia** | `truce-vizia` | Retained-mode with reactive data binding and CSS. Per-param `Signal<f32>` keeps widgets in sync without manual wiring. Desktop only — no iOS, no Windows ARM64. [gui/vizia](gui/vizia.md). |
| **BYO** | `truce-core` + `RawWindowHandle` | Full control — Metal, OpenGL, Skia, anything. You handle painting, input, DPI, and lifecycle yourself. [gui/raw-window-handle](gui/raw-window-handle.md). |

See [gui/README](gui/README.md) for a side-by-side comparison
of the backends.

## Screenshot tests

Catch visual regressions by rendering your GUI headlessly and
diffing the result against a committed reference PNG. One line
across every backend:

```rust
#[test]
fn gui_screenshot() {
    truce_test::screenshot!(Plugin, "screenshots/default.png").run();
}
```

The `screenshot!` macro takes the plugin type plus an explicit
path to the committed reference PNG (relative to the crate's
`Cargo.toml` directory, or absolute). The current render lands
in `target/screenshots/` (gitignored). The first time you run
the test the reference doesn't exist yet — the test fails and
points at `cargo truce screenshot --out <ref-path>` to create
the baseline. Works for every backend (built-in GUI, egui,
iced, slint, vizia).

See [gui/screenshot-testing](gui/screenshot-testing.md) for
the full flow — promoting new references, state-dependent shots
via `setup` / `state_file`, cross-OS reference handling via
`cfg(target_os = …)` gating, and the `cargo truce screenshot`
CLI for renders that don't need a `#[test]`.

## What's next

- **[Chapter 9 → audio-testing](audio-testing.md)** — pair
  GUI screenshot tests with audio regression tests so DSP +
  layout both stay green.
- **[Chapter 11 → hot-reload](hot-reload.md)** — edit the
  layout, save, see the change in the running plugin without
  closing the DAW.
- **[Built-in GUI reference](gui/built-in.md)** — every widget
  constructor, all the cell options, theming.
- **[Screenshot testing](gui/screenshot-testing.md)** — diff
  rendered pixels against committed PNGs.
- **[GUI backends](gui/)** — deep-dives per framework when the
  built-in GUI isn't enough.
