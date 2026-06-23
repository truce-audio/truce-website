# Keyboard input

Plugin editors can read the keyboard — text fields, shortcuts, a
guitar-tab grid, QWERTY-as-MIDI, whatever. Two things have to line up: the
editor window has to *receive* OS key events, and your backend has to
*route* them to your code.

## Where keys come from

- **[Standalone](../../formats/standalone.md)** owns its window, so it
  always gets keys. It also ships QWERTY-as-MIDI, a SPACE transport toggle,
  and Cmd/Ctrl-S preset shortcuts out of the box.
- **Embedded in a DAW**, the editor only sees keys when the host hands the
  plugin's window OS focus — which is host-dependent. Reaper and Bitwig
  generally grant focus on click; some hosts never do, and most reserve
  global keys (spacebar / transport) for themselves. Treat
  embedded-editor keyboard as **best-effort, host-matrixed**: it works
  where the host cooperates and is silent where it doesn't.

Keys flow in through baseview as soon as the window has focus; clicking the
editor is usually enough to take it.

## egui

egui is immediate-mode — read the keyboard each frame from `ui.input`.

```rust
fn ui(&mut self, ui: &mut egui::Ui, _state: &PluginContext<MyParams>) {
    // Shortcuts:
    if ui.input(|i| i.key_pressed(egui::Key::ArrowUp)) {
        // nudge something
    }

    // Raw keys / typed text live in this frame's events:
    ui.input(|i| {
        for event in &i.events {
            if let egui::Event::Key { key, pressed: true, .. } = event {
                // react to `key`
            }
        }
    });

    // Text fields just work:
    ui.text_edit_singleline(&mut self.name);
}
```

## iced

Keys reach iced two ways.

**Widgets.** A focused `text_input`, or any custom `Widget` whose `update`
matches `Event::Keyboard`, receives keys directly — no extra wiring. That
covers text fields and a whole-keyboard capture widget.

```rust
use iced::widget::text_input;

text_input("type here", &self.text)
    .on_input(|s| Message::Plugin(Msg::TextChanged(s)))
```

**Subscriptions.** For shortcuts or capture that isn't tied to a focused
widget, implement `IcedPlugin::subscription` with `iced::keyboard::listen`
or `iced::event::listen_with`. truce drives the subscription each frame and
routes its messages back through your `update`.

```rust
fn subscription(&self) -> iced::Subscription<Message<Msg>> {
    iced::keyboard::listen().map(|event| Message::Plugin(Msg::Key(event)))
}
```

An iced `KeyPressed` carries both the layout-resolved logical key and the
layout-independent `physical_key`, so shortcuts (logical) and
whole-keyboard input (physical, e.g. a tab editor) are both covered.

## Other backends

The built-in GUI, Slint, and Vizia editors don't route keyboard to your
code yet — reach for **egui** or **iced** when the editor needs keys. (The
native window may still receive them; truce just doesn't surface them to
those backends.)

## See also

- [egui integration](egui.md) · [iced integration](iced.md)
- [Standalone](../../formats/standalone.md) — its in-window hotkeys and
  QWERTY-MIDI mapping
