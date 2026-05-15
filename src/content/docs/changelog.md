# Changelog

Notable changes per release.

## 0.41.0 — 2026-05-15

- AAX: Fix knobs sync bug on log-ranged parameters. The C++
  shim defaulted to a linear taper for every param's normalize /
  denormalize, so AAX would round-trip a log-ranged knob through
  `RenderAudio` into a different plain value than the editor
  wrote. Wire `range_type` through `TruceAaxParamInfo` so the shim
  picks the matching `AAX_ITaperDelegate` per param. ABI bump:
  `TRUCE_AAX_ABI_VERSION` 1 → 2.
- Standalone: Drop the "(standalone)" suffix from the window title.
- baseview: bump to the latest revision.
- Workspace: README status updated to **stable**; `repository` /
  `homepage` metadata added to every crate's Cargo.toml for
  crates.io publishing readiness.

## 0.40.2 — 2026-05-14

- Move example READMEs out to truce-website (no code impact).
- Wrap VST3 / VST2 / AU / AAX state-save and state-load callbacks
  in `catch_unwind`. A panic from user `save_state` / `load_state`
  used to unwind across the `extern "C"` FFI boundary back into the
  host — UB on most toolchains, abort on others. The save paths
  now pre-zero the host's out pointers so a panic mid-write leaves
  the host seeing an empty blob rather than a stale buffer.

## 0.40.1 — 2026-05-14

- AU v3: Wire `macos_icon` through the bundle template. When set
  in `truce.toml`, the per-plugin `.icns` is copied into the
  `.app`'s `Contents/Resources/` and `CFBundleIconFile` is added
  to the outer Info.plist, matching the standalone-host behavior.

## 0.40.0 — 2026-05-13

- CLAP: Use the macOS bundle layout (`Contents/MacOS` +
  `Info.plist`). Fixes load in Bitwig
  ([#51](https://github.com/truce-audio/truce/issues/51)).
- CLAP: Wire stubs for `get_resize_hints`, `set_transient`,
  `suggest_title`, `set_size`, `adjust_size` so the custom-editor
  button appears in Bitwig.
- fundsp: New `truce-example-fundsp-reverb-worker` showing a
  background-thread graph rebuild with a lock-free swap into the
  audio thread — `process()` stays allocation-free.
- fundsp: Rename the inline-rebuild example to
  `truce-example-fundsp-reverb-simple` (pedagogical, rt-unsafe).
- Follow stable Rust toolchain (unpin from 1.90).
- Dead-code removal, stylistic fixes.

## 0.39.3 — 2026-05-13

- New example integrating with fundsp; added small helpers.
- AU v2: Fix GUI bug.
- LV2: Fix URI mismatch between manifest and runtime.

## 0.39.2 — 2026-05-13

- Consistent naming scheme for package installers across macOS,
  Windows, and Linux.

## 0.39.1 — 2026-05-13

- Standalone on macOS: Fix audio input after install — was
  missing the audio-input entitlement.

## 0.39.0 — 2026-05-13

- LV2: Add packaging support.
- Enable notarization for example plugins.
- Installer: Harden against permission issues from prior installs.
- Wire `macos_icon`, `windows_icon`, `welcome_bmp`,
  `welcome_html` for example plugins.
- Installer / packaging bug fixes.
- Bump MSRV to 1.90.

## 0.38.0 — 2026-05-12

- LV2: Fix MIDI effect categorization.
- Improved precision ergonomics using fundsp-style preludes.
- **Breaking:** renamed `param.smoothed_next()` to `param.read()` to support consistent float precision use. Upgrade path is a mechanical.
- Minor fixes.

## Backlog

### Known gaps

- **Retail iLok / PACE round-trip.** PACE wraptool is wired and
  exercised against a dev iLok account; we haven't yet round-tripped
  through a retail iLok + retail Pro Tools install. Needed before
  documenting AAX as production-ready.
- **Pro Tools shell-mode smoke test.** Manual: load a `--shell` AAX
  bundle in Pro Tools Developer, confirm hot-reload fires. Pro
  Tools' loader vs. dlopen behavior is the open question.
- **Authenticode round-trip with a real cert.** The Azure Trusted
  Signing / SHA1 thumbprint / `.pfx` paths are wired but haven't
  been exercised with a real EV / OV cert end-to-end.
- **LV2 hosts beyond Reaper.** Ardour, Qtractor, Carla, Jalv, and
  Zrythm are expected to work but haven't been validated. Reaper
  on Linux is the only host currently exercised end-to-end.
- **LV2 in `cargo truce validate`.** No first-party LV2 check is
  wired in yet — validate currently covers CLAP, VST3, and AU.
  Manual loads in Carla or Jalv are the fallback for catching TTL
  or bundle-layout errors.
- **LV2 X11UI in stricter hosts.** truce's X11UI reports the
  parent window as its own widget rather than creating a distinct
  child. Works in Reaper; hosts that enforce a separate child
  window may reject it and need a follow-up.
- **MIDI 2.0 over LV2.** LV2 Atom carries MIDI 1.0 byte streams,
  so plugins emitting MIDI 2.0 channel-voice, per-note, or
  ParamChange events drop those messages when loaded as LV2.
- **Resizable GUIs.** Editors today report a fixed size; CLAP's
  `gui_can_resize` returns `false` and the VST3 / AU / LV2
  paths assume a static frame. Host-driven resize negotiation
  (`gui_adjust_size` / `gui_set_size`, `IPlugViewContentScaleSupport`,
  AU view-frame change notifications, LV2 ui:resize) needs to be
  wired through truce-gui so user code can opt in.

### Future

- More example plugins (delay).
- WebView GUI backend.
- Distribution-grade dynamic shell (today's `--shell` is dev-loop
  only; making it a shipping mechanism is a phase-2 question).
