# Vizia Integration

[Vizia](https://github.com/vizia/vizia) is a declarative GUI
framework with reactive data binding and CSS styling. `truce-vizia`
embeds it via baseview and bridges parameter reads/writes through a
`ParamLens<P>` whose per-param signals keep every widget bound to
the same `id` in sync.

> **Vizia is the least stable of the GUI backends.** It's desktop
> only: macOS (x86_64 + aarch64), Windows (x86_64), and Linux
> (x86_64 + aarch64) work; iOS and Windows on ARM64 are
> unsupported - see [Platform support](#platform-support) below.
> Editor resize is currently a no-op: `ViziaEditor::set_size`
> records the new logical size but the running view doesn't
> repaint at it (vizia's `WindowHandle` has no resize entry point
> callable from outside its event loop; pending a `vizia_baseview`
> upstream patch), so ship vizia plugins fixed-size and don't call
> `.resizable(true)`. The crate also rides an unreleased vizia
> main-branch rev - no crates.io release. Pick egui, iced, or
> Slint for new projects.

## Setup

`truce-vizia` is **not** published on crates.io — vizia upstream
hasn't tagged a release that ships the `baseview` feature flag
(it's main-branch only), and crates.io rejects git-only deps
without a `version` shadow. Pull the crate from git instead:

```toml
[dependencies]
truce-vizia = { git = "https://github.com/truce-audio/truce.git", tag = "v0.54.0" }
```

Bump the tag in lockstep with your other `truce-*` deps on each
release; the sub-workspace inside the truce repo guarantees the
git-pinned vizia rev tracks the rest of the framework's version.

Vizia itself is a transitive dep — no direct `vizia = …` line is
required. `truce-vizia` re-exports it as `truce_vizia::vizia` so
`use truce_vizia::vizia::prelude::*;` brings the full API into scope.

> **Linux:** Vizia renders with Skia, whose build links `-lEGL` and
> `-lwayland-egl`, so on top of the [shared GUI dev
> libraries](../install.md#platform-compiler) you also need the EGL +
> Wayland-EGL **dev** packages (`sudo apt install libegl1-mesa-dev
> libwayland-dev`). Without them the link fails with `rust-lld: error:
> unable to find library -lwayland-egl`. The other GUI backends don't
> link Skia and don't need these.

Return a `ViziaEditor` from `editor()`:

```rust
use truce::prelude::*;
use truce_font::JETBRAINS_MONO;
use truce_vizia::vizia::prelude::*;
use truce_vizia::widgets::{self, param_knob};
use truce_vizia::{ParamLens, ViziaEditor};
use MyParamsParamId as P;

impl PluginLogic for MyPlugin {
    type Params = MyParams;
    type DspState = ();

    fn editor(params: Arc<MyParams>) -> Box<dyn Editor> {
        ViziaEditor::new(
            params.clone(),
            (240, 160),
            |cx: &mut Context, lens: ParamLens<MyParams>| {
                HStack::new(cx, |cx| {
                    param_knob(cx, lens.clone(), P::Gain, "Gain");
                    param_knob(cx, lens.clone(), P::Pan, "Pan");
                })
                .padding(Pixels(10.0))
                .horizontal_gap(Pixels(10.0));
            },
        )
        .with_stylesheet(widgets::BASE_CSS)
        .with_font(JETBRAINS_MONO)
        .into_editor()
    }
}
```

The setup closure is bounded `Fn` (not `FnOnce`) — hosts may close
and re-open the editor, and each open call invokes the closure once
to build a fresh widget tree. `(240, 160)` is the window size in
logical points.

`with_stylesheet(widgets::BASE_CSS)` is recommended when you use
the built-in widgets — it carries vizia compatibility shims (the
collapsing knob head, dropdown popup overflow) without prescribing
any palette. `with_font(JETBRAINS_MONO)` matches the look of every
other built-in editor; omit it to inherit vizia's default font
stack.

## ParamLens

`ParamLens<P>` is the bridge between truce's atomic param store and
vizia's reactive runtime. Every widget bound to the same `id`
shares a `Signal<f32>`, so a knob and an XY pad pointing at the
same param update each other on the next frame without any extra
wiring.

```rust
// Read
lens.get(P::Gain)              // normalized 0.0-1.0
lens.get_plain(P::Gain)        // plain value
lens.format(P::Gain)           // formatted string
lens.meter(P::MeterLeft)       // meter level

// Write (one-shot, for clicks/toggles)
lens.automate(P::Bypass, 1.0);

// Write (continuous drag — records smooth automation)
lens.begin_edit(P::Gain);
lens.set(P::Gain, new_value);  // call each frame during drag
lens.end_edit(P::Gain);
```

`ParamLens<P>` is cheap to clone — hand out clones freely to widgets,
they all share the same underlying store and the same per-param
signals.

## Widgets

`truce-vizia` ships param-binding widgets that handle the gesture
protocol internally:

```rust
use truce_vizia::widgets::{
    param_knob,     // rotary knob with label + formatted value
    param_slider,   // horizontal slider
    param_toggle,   // on/off switch
    param_dropdown, // click-to-open list for enums / int ranges
    param_xy_pad,   // 2D pad for two params
    level_meter,    // vertical bar meter
};
```

Typical layout:

```rust
fn my_view(cx: &mut Context, lens: ParamLens<MyParams>) {
    HStack::new(cx, move |cx| {
        VStack::new(cx, move |cx| {
            HStack::new(cx, |cx| {
                param_knob(cx, lens.clone(), P::Gain, "Gain");
                param_knob(cx, lens.clone(), P::Pan, "Pan");
            });
            param_xy_pad(cx, lens.clone(), P::Pan, P::Gain,
                         "Pan / Gain", 130.0, 130.0);
        });
        level_meter(cx, lens.clone(),
                    &[P::MeterLeft, P::MeterRight], 240.0);
    })
    .padding(Pixels(10.0))
    .horizontal_gap(Pixels(10.0));
}
```

Discrete params (`IntParam`, `EnumParam<T>`) snap to grid steps on
each gesture so the host sees integer / enum positions, not the raw
continuous value baseview hands the widget.

### Using raw vizia widgets

Any vizia widget works — just bind it to the shared signal and
echo writes back through the lens:

```rust
let value_signal = lens.value_signal(P::Gain);
let lens_for_change = lens.clone();
Knob::new(cx, 0.0, value_signal, false)
    .width(Pixels(48.0))
    .height(Pixels(48.0))
    .on_change(move |_cx, val| {
        lens_for_change.automate(P::Gain, f64::from(val));
        value_signal.set(val);
    });
```

`value_signal` is shared across every widget for the same `id`;
echoing the new value into it keeps the rest of the UI in sync.

## Meters

Meter widgets use a separate reactive surface. `level_meter` reads
`lens.meter_signal(id)` — a per-meter `Signal<f32>` driven by a root
polling timer (~30 Hz) inside `ViziaEditor::open` that fans the latest
store values into every registered meter signal. The reactive graph
then re-evaluates the Memos driving the bar heights.

Declaration matches every other backend (see
[parameters § Meters](../parameters.md#meters)):

```rust
#[derive(Params)]
pub struct MyParams {
    // ...
    #[meter] pub meter_l: MeterSlot,
    #[meter] pub meter_r: MeterSlot,
}
```

Push from `process()` with `context.set_meter(P::MeterL, peak)`,
draw with `level_meter(cx, lens, &[P::MeterL, P::MeterR], 240.0)`.

## Theming

Widgets render against vizia's default theme and prescribe no colors
themselves. The `BASE_CSS` constant carries only the minimum CSS
needed for establishing a working baseline. Plugins that want a
particular palette layer their own stylesheet via `with_stylesheet`:

```rust
ViziaEditor::new(params.clone(), (240, 160), my_view)
    .with_stylesheet(widgets::BASE_CSS)
    .with_stylesheet(include_str!("../assets/dark.css"))
    .with_font(JETBRAINS_MONO)
```

Stylesheets are applied in the order they were added, after vizia's
defaults. Each widget tags its outer container with a `truce-*`
class (`truce-knob`, `truce-slider`, `truce-toggle`, …) for targeted
styling.

## Screenshot testing

Vizia screenshots render against a CPU-backed Skia raster surface —
no active OS window or GL context required:

```rust
#[test]
fn gui_screenshot() {
    truce_test::screenshot!(Plugin, "screenshots/default.png").run();
}
```

See [screenshot testing](screenshot-testing.md) for the full flow.

## Platform support

| Platform | Supported | Notes |
|---|---|---|
| macOS (x86_64 + aarch64) | Yes | Universal `cargo truce package` slices |
| Windows (x86_64) | Yes | |
| Linux (x86_64 + aarch64) | Yes | |
| **iOS** | No | Vizia hard-pins `vizia_baseview` and baseview has no `target_os = "ios"` platform impl, so the chain `truce-vizia → vizia → vizia_baseview → baseview` doesn't link on iOS. The `truce-vizia` crate is gated with `#![cfg(not(target_os = "ios"))]`. Use `truce-egui` or `truce-slint` (both ship UIKit-backed editor stubs) or the built-in editor instead. |
| **Windows on ARM64** | No | `skia-bindings` (pulled in by vizia → skia-safe) doesn't build for `aarch64-pc-windows-msvc` on the standard VS 2022 toolchain — its bundled clang 19 ships an incomplete `arm_neon.h`, and the older libclang versions that parse the header trip MSVC STL's `static_assert "expected Clang 19.0.0 or newer"`. Universal Windows installers produced by `cargo truce package` need `--host-only` to skip the ARM64 slice on vizia plugins. |

## Example

[`crates/truce-vizia/examples/truce-example-gain-vizia`](https://github.com/truce-audio/truce/tree/main/crates/truce-vizia/examples/truce-example-gain-vizia)
— complete plugin with knobs, XY pad, meter, JetBrains Mono font,
and per-OS screenshot tests.

[`crates/truce-vizia/examples/truce-example-gui-zoo-vizia`](https://github.com/truce-audio/truce/tree/main/crates/truce-vizia/examples/truce-example-gui-zoo-vizia)
— passthrough plugin exercising every widget kind, every
`ParamUnit` variant, and the discrete-snap path.

Both live in the `truce-vizia` Cargo sub-workspace (the parent
workspace can't include them because vizia's hard-pinned baseview
rev is incompatible with iOS).
