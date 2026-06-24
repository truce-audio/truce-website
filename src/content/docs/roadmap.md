# Roadmap & Known Gaps

## Known gaps

- **Resize.** Host-driven (drag-to-resize) round-trips through
  CLAP, VST3, AU v3, and LV2.
  - **`truce-vizia`.** Programmatic host-driven resize
    (`gui_set_size` without an accompanying parent-`NSView`
    change) records the new logical size on the editor but
    produces no visual change. Unblocks when `vizia_baseview`
    upstream adds a window-event resize variant + handler.
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
- **Factory presets.** Ship to CLAP, VST3, AU, and LV2 on desktop.
  - **VST2.** No `.fxp` emission yet.
  - **AAX (Pro Tools).** Not emitted as AAX `.tfx` yet, so they
    don't appear in Pro Tools' preset menu.
  - **iOS.** The iOS AU v3 appex / framework preset locations
    aren't wired yet, so `cargo truce install` skips them on iOS.
- **Signing & distribution.**
  - **Retail iLok / PACE round-trip.** PACE wraptool is wired and
    exercised against a dev iLok account; we haven't yet
    round-tripped through a retail iLok + retail Pro Tools install.
  - **Authenticode with a real cert.** The Azure Trusted Signing /
    SHA1 thumbprint / `.pfx` paths are wired but haven't been
    exercised with a real EV / OV cert end-to-end.
- **iOS GUI backends.**
  - **`truce-vizia`.** vizia hard-pins
    `https://github.com/vizia/baseview.git` at a rev that doesn't
    build for `aarch64-apple-ios*` (baseview has no UIKit platform
    impl). The crate is gated `#![cfg(not(target_os = "ios"))]`;
    use the built-in editor, `truce-egui`, or `truce-slint` on iOS.
  - **iced.** iced's `iced_winit` calls a desktop-only `winit`
    trait inside a non-iOS-gated branch, so
    `truce-example-gain-iced` doesn't build for
    `aarch64-apple-ios*`. Blocked upstream.
  - **Bring-your-own container.** `cargo truce install --ios`
    always emits the bundled Swift container template (title,
    Play, status, hamburger overlay). Plug-ins that need a bespoke
    shell hand-author it outside the pipeline and load the
    `.appex` truce builds.
- **Editor keyboard input** is wired for `truce-egui`, `truce-iced`,
  `truce-slint`, and `truce-vizia` (and the standalone host). The
  **built-in GUI** editor currently drops key events, so editor text
  fields and keyboard shortcuts aren't available there yet. Use egui,
  iced, slint, or vizia when the editor needs the keyboard.
  (Embedded-editor keys are host-dependent regardless of backend; see
  [Keyboard input](guide/gui/keyboard.md).)
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
