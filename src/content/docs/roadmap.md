# Roadmap & Known Gaps

## Known gaps

- **Resize.** Host-driven (drag-to-resize) round-trips through
  CLAP, VST3, AU v3, and LV2.
  - **VST2.** Resizable editors aren't wired, so a VST2 editor
    opens (and stays) at its natural size.
  - **AU v2.** Resizable editors round-trip under AU v3 but not
    the AU v2 component, so an AU v2 editor opens at its natural
    size. Use AU v3 for resizable GUIs on macOS.
  - **AAX (Pro Tools).** A plugin can resize its own editor (the
    GUI's `request_resize` forwards to
    `AAX_IViewContainer::SetViewSize()`), but the reverse
    direction isn't wired: AAX's `AAX_CEffectGUI` exposes no
    inbound size-change callback like VST3's `onSize` or CLAP's
    `gui_set_size`, so dragging the Pro Tools window edge doesn't
    resize the editor.
  - **`truce-vizia`.** Editor resize is a no-op: `set_size` records
    the new logical size but vizia's `WindowHandle` exposes no
    resize entry point callable from outside its event loop, so the
    view doesn't repaint at it. Ship vizia plugins fixed-size.
    Pending a `vizia_baseview` upstream patch.
- **Factory presets.** Ship to CLAP, VST3, AU (macOS + iOS), and LV2.
  - **VST2.** No `.fxp` emission yet.
  - **AAX (Pro Tools).** Not emitted as AAX `.tfx` yet, so they
    don't appear in Pro Tools' preset menu.
- **Signing & distribution.**
  - **Retail iLok / PACE round-trip.** PACE wraptool is wired and
    exercised against a dev iLok account; we haven't yet
    round-tripped through a retail iLok + retail Pro Tools install.
- **iOS GUI backends.**
  - **`truce-vizia`.** vizia hard-pins `vizia_baseview` at a rev that
    doesn't build for `aarch64-apple-ios*` (baseview has no UIKit
    platform impl), so the crate is gated
    `#![cfg(not(target_os = "ios"))]`. Use the built-in editor,
    `truce-egui`, `truce-iced`, or `truce-slint` on iOS.
  - **Bring-your-own container.** `cargo truce install --ios`
    always emits the bundled Swift container template (title,
    Play, status, hamburger overlay). Plug-ins that need a bespoke
    shell hand-author it outside the pipeline and load the
    `.appex` truce builds.
- **MIDI 2.0 over LV2.** LV2 Atom carries MIDI 1.0 byte streams,
  so plugins emitting MIDI 2.0 channel-voice, per-note, or
  ParamChange events drop those messages when loaded as LV2.
- **Standalone Settings / Presets menu on Linux.** The X11
  standalone has no native menu bar, so the audio / MIDI Settings
  pickers and the Presets menu aren't drawn on Linux. Drive those
  from the keyboard shortcuts (Cmd/Ctrl+S and Cmd/Ctrl+Shift+S for
  Save / Save As, transport and octave keys) and the CLI flags
  (`--preset`, `--output`, `--midi-input`, ...) instead; macOS and
  Windows get the full menus.

## Future

- WebView GUI backend.
