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

### Forwarding unused keys to the host

In a DAW, pressing Space should start the host transport, not get
swallowed by a focused plugin. So truce's egui backend forwards every key
your UI hasn't claimed back to the host, and keeps only the ones you ask
for.

Call `truce_egui::claim_keys` each frame with the keys you handle
(`egui::Key::ALL` for every key); everything else goes to the host. A
focused text field keeps every key without a claim, and while an egui
popup is open (a `ComboBox`, including `param_dropdown`, or a menu) the
editor keeps plain keys so Escape and the arrows work in it. A key held
with Cmd / Ctrl / Alt goes to the host even if you claimed the key; claim
the chord itself with `truce_egui::claim_shortcuts`.

```rust
fn ui(&mut self, ui: &mut egui::Ui, _state: &PluginContext<MyParams>) {
    // This editor drives a step grid with the arrow keys and loads
    // presets with the number row. Claim exactly those; let the host
    // keep Space, Return, and its arrange shortcuts.
    truce_egui::claim_keys(
        ui.ctx(),
        &[
            egui::Key::ArrowLeft,
            egui::Key::ArrowRight,
            egui::Key::Num1,
            egui::Key::Num2,
        ],
    );

    // ... draw the UI and read the claimed keys from `ui.input` as usual.
}
```

A claim covers only the frame that made it, and claims made in one frame
add up, so each panel can claim its own keys: claim inside the code that
draws the panel, and when the panel closes its keys go back to the host on
the next frame. Keep the claimed set tight. A claimed key never reaches the
host, so claiming broadly brings back the swallowed-transport problem.

```rust
use egui::{Key, KeyboardShortcut, Modifiers};
// Cmd+Z on macOS, Ctrl+Z elsewhere.
truce_egui::claim_shortcuts(ui.ctx(), &[KeyboardShortcut::new(Modifiers::COMMAND, Key::Z)]);
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

**Unused keys go to the host.** truce returns each key to the host unless
an iced widget consumed it: a focused `text_input` or a capture widget
that handled the key keeps it, and everything else (Space, the host's
transport and arrange shortcuts) reaches the DAW. A key you handle in
`subscription()` (`keyboard::listen`, `event::listen_with`) arrives there
unconsumed, so both the plugin and the host would act on it. Keep it by
returning `true` from `IcedPlugin::keeps_key`, answering from your own
state for keys you only sometimes use:

```rust
fn keeps_key(&self, event: &truce_iced::iced::keyboard::Event) -> bool {
    use truce_iced::iced::keyboard::{Event, Key, key::Named};
    let key = match event {
        Event::KeyPressed { key, .. } | Event::KeyReleased { key, .. } => key,
        _ => return false,
    };
    self.sequencer_open && matches!(key, Key::Named(Named::ArrowLeft | Named::ArrowRight))
}
```

## Slint

Keys flow into Slint's own input system, so handle them the Slint way in
your `.slint` markup — a focused `LineEdit` / `TextInput` receives typed
text, and a `FocusScope` with a `key-pressed(event)` callback captures keys
when focused:

```slint
focus := FocusScope {
    key-pressed(event) => {
        root.last-key = event.text;
        accept
    }
    // give it focus (e.g. a TouchArea calling focus()), then type
}
```

Like iced, slint needs no `claim_keys` call: truce returns each key to the
host unless a focused slint item consumed it. A `FocusScope` whose handler
returns `accept`, or a focused `LineEdit` / `TextInput`, keeps the key;
anything `reject`ed or sent while nothing is focused (Space, the host's
transport and arrange shortcuts) reaches the DAW. Returning `reject` from a
`key-pressed` handler is how you deliberately pass a key through to the host.

## Vizia

Keys flow into Vizia's own reactive event system. A focused `Textbox`
receives typed text automatically; for shortcuts or a key mirror, catch
`WindowEvent::KeyDown` in a `Model` (it propagates up to the root even
while a textbox holds focus):

```rust
impl Model for KeyCapture {
    fn event(&mut self, _cx: &mut EventContext, event: &mut Event) {
        event.map(|e: &WindowEvent, _| {
            if let WindowEvent::KeyDown(code, _) = e {
                self.last_key.set(format!("{code:?}"));
            }
        });
    }
}
```

## Other backends

The built-in GUI editor doesn't route keyboard to your code yet. Reach for
**egui**, **iced**, **Slint**, or **Vizia** when the editor needs keys. (The
native window may still receive them; truce just doesn't surface them to the
built-in editor.)

## See also

- [egui integration](egui.md) · [iced integration](iced.md) ·
  [Slint integration](slint.md) · [Vizia integration](vizia.md)
- [Standalone](../../formats/standalone.md) — its in-window hotkeys and
  QWERTY-MIDI mapping
