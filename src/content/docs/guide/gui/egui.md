# egui Integration

`truce-egui` embeds [egui](https://github.com/emilk/egui) into a plugin
window via wgpu + baseview. You get the full egui API — `CentralPanel`,
`SidePanel`, `Window`, `Canvas`, third-party crates — with parameter
hosting handled for you.

## Setup

```toml
[dependencies]
truce-egui = "2.0"
egui = "0.34"
```

Return an `EguiEditor` from `editor()`:

```rust
use truce::prelude::*;
use truce_egui::EguiEditor;
use truce_egui::widgets::param_knob;
use MyParamsParamId as P;

impl PluginLogic for MyPlugin {
    type Params = MyParams;

    fn editor(params: Arc<MyParams>) -> Box<dyn Editor> {
        EguiEditor::new(
            params.clone(),
            (400, 300),
            |ui: &mut egui::Ui, state: &PluginContext<MyParams>| {
                ui.heading("My Plugin");
                param_knob(ui, state, P::Gain, "Gain");
            },
        )
        .into_editor()
    }
}
```

The closure is your egui frame function — it runs every frame, same as
`eframe::App::update`. `(400, 300)` is the window size in logical points.
The `&mut Ui` you receive is the root UI for the editor window — nest
`Panel::top`, `CentralPanel`, etc. with `.show_inside(ui, …)` if you
want them. `PluginContext<MyParams>` is typed for direct `Deref` access
to the plugin's `Params` fields (`state.gain.read()` etc.) inside the
closure.

## PluginContext

`PluginContext<P>` is the bridge between egui and the DAW's parameter
system. It wraps `begin_edit` / `set_param` / `end_edit` into an
ergonomic API; IDs use `#[derive(Params)]`'s generated `*ParamId` enum
and convert to `u32` through `impl Into<u32>`:

```rust
// Read
state.get_param(P::Gain)         // normalized 0.0-1.0
state.get_param_plain(P::Gain)   // plain value (-60.0 dB)
state.format_param(P::Gain)      // display string ("0.0 dB")
state.get_meter(P::MeterLeft)    // meter level 0.0-1.0

// Write (one-shot, for clicks/toggles)
state.automate(P::Bypass, 1.0);

// Write (continuous drag — records smooth automation)
state.begin_edit(P::Gain);
state.set_param(P::Gain, new_value);  // call each frame during drag
state.end_edit(P::Gain);
```

## Widgets

`truce-egui` provides parameter-aware widgets that handle the gesture
protocol internally. Use these or roll your own with raw egui widgets.

```rust
use truce_egui::widgets::{
    param_knob,     // rotary knob
    param_slider,   // horizontal slider
    param_toggle,   // on/off switch
    param_dropdown, // popup list for enums / discrete int ranges
    param_xy_pad,   // 2D pad for two params
    level_meter,    // vertical bar meter
};
```

Typical layout:

```rust
fn my_ui(ui: &mut egui::Ui, state: &PluginContext<MyParams>) {
    ui.horizontal(|ui| {
        param_knob(ui, state, P::Gain, "Gain");
        param_knob(ui, state, P::Pan, "Pan");
        level_meter(ui, state, &[P::MeterLeft, P::MeterRight], 200.0);
    });
    param_xy_pad(ui, state, P::Pan, P::Gain, "Pan / Gain", 130.0, 130.0);
}
```

### Using raw egui widgets

Any egui widget works — just wire the gesture protocol manually:

```rust
let mut value = state.get_param(P::Gain) as f32;
let response = ui.add(egui::Slider::new(&mut value, 0.0..=1.0));
if response.drag_started() { state.begin_edit(P::Gain); }
if response.changed()      { state.set_param(P::Gain, value as f64); }
if response.drag_stopped() { state.end_edit(P::Gain); }
```

## Theme

A dark theme is applied by default. Pass any `egui::Visuals` to override
it — use egui's built-in light/dark themes, the truce defaults, or your
own:

```rust
// Use egui's built-in light theme
EguiEditor::new(params.clone(), (400, 300), my_ui)
    .with_visuals(egui::Visuals::light())

// Or customize the truce dark theme as a starting point
EguiEditor::new(params.clone(), (400, 300), my_ui)
    .with_visuals(truce_egui::theme::dark())
    .with_font(truce_gui::font::JETBRAINS_MONO)
```

You can also call `ui.ctx().set_visuals()` inside your frame function
to switch themes at runtime.

The truce theme exports color constants for consistency with the
built-in GUI widgets:

```rust
use truce_egui::theme::{BACKGROUND, SURFACE, PRIMARY, TEXT, TEXT_DIM,
                         HEADER_BG, HEADER_TEXT, KNOB_FILL, METER_CLIP};
```

## Stateful UIs (EditorUi trait)

The closure API works for simple UIs. For state across frames (tabs,
caches, animations), implement `EditorUi<P>`:

```rust
use truce_egui::EditorUi;

struct MyUi { tab: usize }

impl EditorUi<MyParams> for MyUi {
    fn ui(&mut self, ui: &mut egui::Ui, state: &PluginContext<MyParams>) {
        ui.horizontal(|ui| {
            ui.selectable_value(&mut self.tab, 0, "Controls");
            ui.selectable_value(&mut self.tab, 1, "Settings");
        });
        // draw based on self.tab
    }
}

// In editor():
EguiEditor::with_ui(params.clone(), (640, 480), MyUi { tab: 0 }).into_editor()
```

`EditorUi<P>` has three methods:

| Method | When | Use for |
|---|---|---|
| `opened(&mut self, &PluginContext<P>)` | Editor window opens | Initialize `StateBinding`, load resources |
| `ui(&mut self, &mut egui::Ui, &PluginContext<P>)` | Every frame | Draw your UI |
| `state_changed(&mut self, &PluginContext<P>)` | Preset recall, undo, session load | Re-sync cached state |

All have default no-ops. Only `ui()` is required.

## Custom persistent state

If your plugin has state beyond parameters (`save_state` / `load_state`),
use `StateBinding<T>` to keep the editor in sync:

```rust
#[derive(State, Default)]
pub struct MyState {
    pub instance_name: String,
    pub view_mode: u8,
}

struct MyUi {
    state: StateBinding<MyState>,
}

impl EditorUi<MyParams> for MyUi {
    fn opened(&mut self, ctx: &PluginContext<MyParams>) {
        self.state = StateBinding::new(ctx.clone().dyn_erase());
    }

    fn ui(&mut self, ui: &mut egui::Ui, _ctx: &PluginContext<MyParams>) {
        ui.label(&self.state.get().instance_name);
    }

    fn state_changed(&mut self, _ctx: &PluginContext<MyParams>) {
        self.state.sync();
    }
}
```

Write state back from the GUI:

```rust
self.state.update(|s| s.instance_name = new_name);
```

For the closure API, use `.on_state_changed()`:

```rust
EguiEditor::new(params.clone(), (400, 300), |ui, state| { /* ui */ })
    .on_state_changed(|state| { /* re-read cached state */ })
```

If your plugin only uses `#[param]` fields, skip this section —
parameters sync automatically every frame.

## Screenshot testing

```rust
#[test]
fn gui_screenshot() {
    truce_test::screenshot!(Plugin, "screenshots/default.png").run();
}
```

See [screenshot testing](screenshot-testing.md) for more.

## Examples

[`examples/truce-example-gain-egui`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-gain-egui) — complete plugin with knobs, XY pad, meter,
header, custom font, and screenshot test.

[truce-analyzer](https://github.com/truce-audio/truce-analyzer) — non-trivial
out-of-tree example built on egui: real-time spectrum analyzer with a diff
overlay. Shows what scaled-up egui code looks like for a plugin GUI.
