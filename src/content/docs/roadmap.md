# Roadmap & Known Gaps

## Known gaps

- **Retail iLok / PACE round-trip.** PACE wraptool is wired and
  exercised against a dev iLok account; we haven't yet round-tripped
  through a retail iLok + retail Pro Tools install.
- **Authenticode round-trip with a real cert.** The Azure Trusted
  Signing / SHA1 thumbprint / `.pfx` paths are wired but haven't
  been exercised with a real EV / OV cert end-to-end.
- **MIDI 2.0 over LV2.** LV2 Atom carries MIDI 1.0 byte streams,
  so plugins emitting MIDI 2.0 channel-voice, per-note, or
  ParamChange events drop those messages when loaded as LV2.
- **`truce-vizia` resize.** Programmatic host-driven resize
  (`gui_set_size` without an accompanying parent-`NSView` change)
  records the new logical size on the editor but produces no
  visual change. Unblocks when `vizia_baseview` upstream adds a
  window-event resize variant + handler.
- **`truce-vizia` on iOS.** vizia hard-pins
  `https://github.com/vizia/baseview.git` at a rev that doesn't
  build for `aarch64-apple-ios*` (baseview has no UIKit
  platform impl). The `truce-vizia` crate is gated
  `#![cfg(not(target_os = "ios"))]`; use the built-in editor,
  `truce-egui`, or `truce-slint` on iOS.
- **Bring-your-own iOS container.** `cargo truce install --ios`
  always emits the bundled Swift container template (title, Play,
  status, hamburger overlay). Plug-ins that need a bespoke shell
  hand-author it outside the pipeline and load the `.appex` truce
  builds.
- **iced on iOS.** iced's `iced_winit` calls a desktop-only `winit`
  trait inside a non-iOS-gated branch, so `truce-example-gain-iced`
  doesn't build for `aarch64-apple-ios*`. Blocked upstream.
- **Standalone Settings / Presets menu on Linux.** The X11
  standalone has no native menu bar, so the audio / MIDI Settings
  pickers and the Presets menu aren't drawn on Linux. Drive those
  from the keyboard shortcuts (Cmd/Ctrl+S and Cmd/Ctrl+Shift+S for
  Save / Save As, transport and octave keys) and the CLI flags
  (`--preset`, `--output`, `--midi-input`, ...) instead; macOS and
  Windows get the full menus.
- **AAX presets (Pro Tools).** Factory presets ship to CLAP, VST3,
  AU, and LV2, but aren't emitted as AAX `.tfx` yet, so they don't
  appear in Pro Tools' preset menu.

## Future

- WebView GUI backend.
