# Changelog

Notable changes per release.

## 0.45.2 — 2026-05-19

- AAX: Fix ABI mismatch bug (broken since 0.43.0).
- AAX / `cargo-truce`: Add Pro Tools `pluginrunner` to
  `cargo truce validate` (used if present).
- LV2: Fix editor positioning quirks (some quirks remain but no
  showstoppers).
- `cargo-truce`: Update help with `--target-cpu`.
- `cargo-truce`: Thread `--target-cpu` args through `install`,
  `package`, and `run` commands (with sane defaults).
- `cargo-truce`: `status` no longer runs auval (too slow for the
  purpose); use `validate` for that.
- Stylistic sweep.

## 0.45.0 — 2026-05-18

- New CI gate exercises every prior release's example crates
  against the current `truce` HEAD, catching backwards-incompatible
  changes before they ship.
- **Initial SIMD block operations.** New `truce-simd` crate ships
  `wide`-backed `scale_block` / `mul_block` / `mix_block` /
  `mac_block` / `copy_block` / `zero_block` plus `tanh_block` /
  `db_to_linear_block` / `linear_to_db_block` math helpers, with
  scalar fallbacks. Six new examples (`gain-simd`, `saturate`,
  `drywet`, `gate`, `widen`, `surround-meter`) demonstrate the
  shapes.
- **`cargo truce build` now defaults x86_64 builds to
  `-C target-cpu=x86-64-v3`** (AVX2 + FMA + BMI2) so the SIMD
  paths above activate without any per-developer config. New
  `--target-cpu <value>` flag accepts `baseline` (rustc default
  = SSE2-only), `v2` / `v3` / `v4`, `native` for the local-CPU
  dev-loop, or any literal rustc target-cpu name.
- Plugin display names that contain filesystem-reserved characters
  (e.g. `Truce Dry/Wet`) are now sanitized at the path-construction
  boundary, so the on-disk bundle lands at `Truce Dry-Wet.aaxplugin`
  while DAWs still display the raw name from the plist.

## 0.44.0 — 2026-05-18

- **VST3 + CLAP on macOS now link as `MH_BUNDLE` instead of
  `MH_DYLIB`.** Fixes load under hosts that take the strict
  `CFBundleLoadExecutable` path (DawDreamer's JUCE-based VST3
  host is the one we validated against). Most desktop DAWs have
  more forgiving loaders and weren't affected, but the strict
  path is the correct Mach-O shape for a bundle. Built from a
  Rust `staticlib` via `clang -bundle`. **Breaking change for
  pre-0.44.0 plugins:** the plugin crate's `[lib]` block needs
  `crate-type = ["cdylib", "staticlib", "rlib"]` (was `["cdylib",
  "rlib"]`). `cargo truce install` / `package` fails loudly with
  the exact one-line edit if the staticlib is missing.
- AU v3: Fix installs broken since 0.42.0.
- AU v2: Fix `PresentPreset` handler broken since 0.40.0 — auval
  passes again across all bundled examples.
- `cargo truce package --formats <list>` now works on Linux, matching
  the existing macOS / Windows behavior. Internally drives the
  underlying `cargo truce build` invocation.
- CI hardening: every `cargo truce` subcommand (install, validate,
  package, uninstall, doctor, status, reset-au) now runs on macOS,
  Linux, and Windows on every PR. New scaffold-and-round-trip
  workflow exercises `cargo truce new` against single-effect,
  single-instrument, and mixed-workspace shapes.
- Doc sweep across the in-tree comments and rustdoc.

## 0.43.0 — 2026-05-17

- **SysEx + UMP support (work in progress).** Initial plumbing
  for System Exclusive messages and MIDI 2.0 UMPs is landing
  across the CLAP, VST3, VST2, AU v2, AU v3, AAX, and LV2
  wrappers. SysEx bytes flow through `EventBody::SysEx` on the
  existing `EventList`, backed by a pre-allocated pool so
  `process()` stays allocation-free. A new `truce::ump` module
  decodes channel-voice-2 messages and reassembles fragmented
  SysEx7 / SysEx8 packets. APIs are not stable yet and host
  coverage is still being shaken out — expect breaking changes
  in the next few patches.

## 0.42.1 — 2026-05-17

- Params: `IntParam` value displays no longer pick up the
  `FloatParam` `{:.1}` / `{:.2}` formatters, so transpose's
  semitone knob now reads `0 st` instead of `0.0 st`. Internally,
  `ParamInfo` gained a `kind: ParamValueKind` field set by
  `#[derive(Params)]` from the field type — hand-rolled `Params`
  impls building `ParamInfo` literally need to add `kind: …`
  (Float / Int / Bool / Enum).
- Example tidy: the `Mix` knobs on both fundsp reverbs and the
  `Depth` knob on tremolo now declare `unit = "%"`, so they render
  as `25%` / `0%` instead of `0.25` / `0.00`.

## 0.42.0 — 2026-05-16

- **iOS support.** AU v3 plug-ins now build, install, and run on
  both the iOS Simulator (`cargo truce install --ios`) and tethered
  devices (`cargo truce install --ios-device`). Truce ships a Swift
  container app template with embedded editor, Play button, status
  label, info sheet, and a hamburger-menu landscape layout. New
  `[[plugin]]` knobs in `truce.toml`: `ios_icon_set`,
  `ios_orientations`, `ios_scale_editor_to_fit` (default `true`),
  `ios_minimum_os_version`, `ios_app_group`, `ios_url`. Touch input
  is pinned per-finger so multi-touch doesn't hijack an in-progress
  drag. `mute_preview_output` works on both standalone and the iOS
  container for analyzer-style plug-ins. Custom container apps and
  iced's iOS backend remain unsupported (latter blocked upstream).
  See the new [iOS chapter](/docs/guide/ios).
- iOS screenshot regression: `cargo truce screenshot --ios` captures
  the simulator's actual rendered output (the only path that sees
  iOS-specific compositing); `--check` gates baselines in CI.

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
- **Bring-your-own iOS container.** `cargo truce install --ios`
  always emits the bundled Swift container template (title, Play,
  status, hamburger overlay). Plug-ins that need a bespoke shell
  hand-author it outside the pipeline and load the `.appex` truce
  builds. First-class support for swapping in a custom container
  is on the roadmap.
- **iced on iOS.** iced's `iced_winit` calls a desktop-only `winit`
  trait inside a non-iOS-gated branch, so `truce-example-gain-iced`
  doesn't build for `aarch64-apple-ios*`. Blocked upstream.
- **MIDI SysEx.** truce's MIDI surface today covers channel-voice
  + MIDI 2.0 UMP; raw SysEx messages aren't plumbed through the
  per-format event lists. Plug-ins needing SysEx (preset dumps,
  bulk parameter exchange, MTC) need to wait for the SysEx event
  variants to land.

### Future

- More example plugins (delay).
- WebView GUI backend.
- Distribution-grade dynamic shell (today's `--shell` is dev-loop
  only; making it a shipping mechanism is a phase-2 question).
