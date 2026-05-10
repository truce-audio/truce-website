# VST3

Steinberg's VST3 is the most widely-supported plugin format in
commercial DAWs. Truce implements it through a thin C++ shim
(`truce-vst3/shim/vst3_shim.cpp`, MIT-licensed) that implements the
COM vtables required by the VST3 ABI and forwards every callback
into Rust.

## Status

Production. Shipped in the scaffold defaults. Passes pluginval at
strictness level 5. Tested in Reaper, Ableton Live, FL Studio on
macOS and Windows, and Reaper on Linux.

## Enable

Already on in scaffolded plugins. Otherwise:

```toml
[features]
default = ["clap", "vst3"]
vst3 = ["dep:truce-vst3"]
```

## Requirements

- **macOS**: Xcode CLI tools for the C++ compiler. `xcode-select
  --install`.
- **Windows**: MSVC toolchain (Visual Studio 2019+ with the
  "Desktop development with C++" workload).
- **Linux**: GCC or Clang with C++17 support.

No Steinberg SDK required — the shim is a clean-room COM
implementation with MIT licensing.

## Install paths

User-scope by default; pass `--system` for the system-wide path.

| Platform | User (default) | System (`--system`) |
|----------|----------------|---------------------|
| macOS    | `~/Library/Audio/Plug-Ins/VST3/{Name}.vst3/` | `/Library/Audio/Plug-Ins/VST3/{Name}.vst3/` (sudo) |
| Windows  | `%LOCALAPPDATA%\Programs\Common\VST3\{Name}.vst3\` | `%COMMONPROGRAMFILES%\VST3\{Name}.vst3\` (admin) |
| Linux    | `~/.vst3/{Name}.vst3/` | same (Linux is user-only) |

The `.vst3` on disk is a real bundle directory with a proper `Contents/`
hierarchy:

```
{Name}.vst3/
└─ Contents/
   ├─ Info.plist                     (macOS)
   └─ {MacOS,x86_64-win,x86_64-linux}/
      └─ {Name}           (the dylib/dll/so)
```

`cargo truce install` builds the bundle and signs the binary for
macOS. The user-scope default writes to your home directory with no
elevation; pass `--system` to land in the system-wide directory
(sudo on macOS, Administrator shell on Windows).

## Signing

- **macOS**: bundles are codesigned with `$TRUCE_SIGNING_IDENTITY`
  during install. Host loaders on Apple Silicon refuse unsigned VST3
  bundles; ad-hoc (`-`) is accepted for local use.
- **Windows**: binaries aren't signed by `install`; `cargo truce
  package` Authenticode-signs them via `signtool` before bundling
  into the Inno Setup installer. Unsigned VST3 on Windows just
  produces a SmartScreen prompt for end users; DAWs still load it.
- **Linux**: no signing.

## Build / install / package

```sh
cargo truce install --vst3           # build + install VST3 only
cargo truce install                  # all enabled (VST3 is on by
                                      # default)
cargo truce build --vst3             # bundle into target/bundles/
cargo truce package --formats vst3   # signed installer with just VST3
```

## Validate

`cargo truce validate` invokes Tracktion
[pluginval] if installed (`PLUGINVAL` env var to override path).
Strictness 5 exercises: channel layouts, parameter ranges, preset
I/O, silent-input behavior, real-time safety heuristics.

[pluginval]: https://github.com/Tracktion/pluginval

## Hosts

| Host | Platform | Status |
|------|----------|--------|
| Reaper | macOS / Windows / Linux | primary |
| Ableton Live | macOS / Windows | working |
| FL Studio | macOS / Windows | working |
| Cubase | — | not yet tested |
| Studio One | — | not yet tested |

## Gotchas

- **Class ID (`vst3_id`)** in `truce.toml` (auto-derived from
  vendor + plugin bundle_id if not set) must not change after release.
  VST3 hosts key automation and presets on it.
- **System-scope install needs elevation.** macOS:
  `/Library/Audio/Plug-Ins/VST3/` requires `sudo`. Windows:
  `%COMMONPROGRAMFILES%\VST3\` requires an Administrator shell.
  The user-scope default (no flag, or `--user`) writes to
  `~/Library/...` / `%LOCALAPPDATA%\...` and skips elevation —
  every modern VST3 host scans both roots.
- **IRunLoop on Linux**: Reaper doesn't require the VST3 IRunLoop
  timer integration; Bitwig and Ardour on Linux may. Not yet
  verified — a known-possible risk for those hosts on Linux.
