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

## Future

- WebView GUI backend.
