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
- **Sidechain / aux inputs.** A `with_sidechain_input(...)` layout gives
  the plugin a separate sidechain bus on CLAP, VST3, AU (v2 + v3), AAX,
  VST2, and the standalone host.
  - **LV2.** Sidechain plugins run main-only. The LV2 `.ttl` port list is
    generated at compile time from the plugin category, so it can't yet
    read the sidechain ports from `bus_layouts()`; declaring them only at
    runtime would shift every port index past the main bus. The wrapper
    drops the sidechain to keep the runtime port map aligned with the
    `.ttl` (a one-time log notes this), so the plugin loads and processes
    its main bus normally - it just receives no sidechain signal. Full
    support requires install-time `.ttl` rendering from the real layout.
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
- **MIDI 2.0.** Full MIDI 2.0 (UMP channel-voice, high-resolution and
  per-note controllers) only round-trips on **CLAP** and **AU v3**, and
  only when the host negotiates the 2.0 protocol. A plugin that declares
  a MIDI 2.0 port still receives MIDI 1.0 from a host that offers only
  1.0 - most DAWs today - with the host down-converting on the way in.
  - **VST3.** No UMP transport. Per-note messages round-trip through
    VST3 note expression, but a MIDI 2.0 channel-voice message with no
    note-expression equivalent (an unmapped per-note CC, say)
    down-converts to a MIDI 1.0 channel message on output.
  - **VST2, AU v2, AAX, LV2.** MIDI 1.0 only - 3-byte packets on VST2 /
    AU v2 / AAX, MIDI 1.0 byte streams in the LV2 Atom. Input is always
    MIDI 1.0, and 2.0 channel-voice output down-converts to 1.0. Any
    message with no 1.0
    form (per-note controllers, per-note pitch bend) is dropped.
- **MPE / per-note expression.** Per-note expression - MPE (per-note
  pitch bend + CC spread across MIDI channels) and MIDI 2.0 per-note
  controllers - round-trips on CLAP, VST3, and AU hosts that route
  multi-channel MIDI to an instrument.
  - **Pro Tools (AAX).** Pro Tools treats each MIDI channel as a
    separate track, so multi-channel MIDI does not survive on a single
    instrument track: notes reaching an instrument collapse onto one
    channel (a multi-channel file even imports as one track per
    channel). A note effect that fans notes across channels into an
    instrument on the same track (an MPE-style voice allocator) loses
    the spread in Pro Tools, though the same chain works in CLAP, VST3,
    and AU hosts. This is a Pro Tools MIDI-routing limitation, not a
    wrapper gap - truce emits and preserves the per-note channels
    correctly on the AAX wire. AAX-specific note expression has not been
    wired, so there is no per-note-expression path to Pro Tools today.
- **Standalone Settings / Presets menu on Linux.** The X11
  standalone has no native menu bar, so the audio / MIDI Settings
  pickers and the Presets menu aren't drawn on Linux. Drive those
  from the keyboard shortcuts (Cmd/Ctrl+S and Cmd/Ctrl+Shift+S for
  Save / Save As, transport and octave keys) and the CLI flags
  (`--preset`, `--output`, `--midi-input`, ...) instead; macOS and
  Windows get the full menus.

## Future

- WebView GUI backend.
