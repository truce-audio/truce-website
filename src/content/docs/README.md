# Quick start

```sh
# One-time install
cargo install cargo-truce

# Scaffold a plugin
cargo truce new my-plugin
cd my-plugin

# Run standalone — no DAW needed
cargo truce run

# Build and install for your DAW
cargo truce install --clap
cargo truce install --vst3
```

Open your DAW, scan for plugins, load `MyPlugin`. For a chapter-by-chapter walkthrough, follow the [Guide](#guide) from [install](guide/install.md) through [hot reload](guide/hot-reload.md). For look-up material — every CLI flag, every `#[param(...)]` key, every `truce.toml` field — jump to the [Reference](#reference).

> **Build profile.** Every `cargo truce` command (`install`, `build`, `package`, `run`, `screenshot`) defaults to the cargo **release** profile — plugins are typically loaded into a DAW where debug-build DSP can spike CPU under load. Pass `--debug` to opt into the cargo dev profile for fast-compile iteration.

## Guide

A walkthrough of building, iterating on, and shipping a truce plugin. Read top-to-bottom on first pass; return to specific chapters as needed.

| # | Chapter | What you get |
|---|---------|--------------|
| 1 | [install](guide/install.md) | Rust + the platform compiler + `cargo install cargo-truce` + `cargo truce doctor`. CLAP+VST3 minimum-friction setup; AU/AAX/packaging deferred. |
| 2 | [first-plugin](guide/first-plugin.md) | `cargo truce new`, a tour of the generated files, `install`, load in a DAW. |
| 3 | [plugin-anatomy](guide/plugin-anatomy.md) | `PluginLogic` trait, bus layouts, state persistence. |
| 4 | [parameters](guide/parameters.md) | `#[derive(Params)]`, smoothing patterns, meters. Attribute reference in [reference/params](reference/params.md). |
| 5 | [processing](guide/processing.md) | `process()` patterns for effects, MIDI, sample-accurate events, synths. |
| 6 | [midi](guide/midi.md) | Reading and emitting MIDI events; per-format support; testing MIDI plugins. |
| 7 | [gui](guide/gui.md) | Built-in GUI widgets + the alternative backends (egui, iced, Slint, raw window handle). |
| 8 | [audio-testing](guide/audio-testing.md) | `truce_test::PluginDriver` for in-process audio + MIDI regression tests — no DAW required. |
| 9 | [shipping](guide/shipping.md) | `cargo truce install / build / validate / package`, signing, installers. |
| 10 | [hot-reload](guide/hot-reload.md) | ~2 second edit → hear loop with `--shell`. Experimental — dev-loop only. |

### GUI backends

Pick a toolkit. The built-in widget set covers most plugin UIs; the alternatives are there when you need something the built-in widgets don't ship.

- [Built-in widgets](guide/gui/built-in.md) — `GridLayout` builder, every widget constructor, theming
- [egui](guide/gui/egui.md) · [iced](guide/gui/iced.md) · [Slint](guide/gui/slint.md) · [Raw window handle](guide/gui/raw-window-handle.md)
- [Screenshot testing](guide/gui/screenshot-testing.md) — visual regression tests for the GUI

## Reference

Not exhaustive — for the full Rust API surface, see the [rustdoc](https://truce-audio.github.io/truce/).

| Page | What's in it |
|------|--------------|
| [cli](reference/cli.md) | Every `cargo truce` subcommand and flag — `new`, `install`, `build`, `validate`, `package`, `run`, `doctor`, `uninstall`, `screenshot`. |
| [params](reference/params.md) | `#[derive(Params)]` and `#[param(...)]` — every attribute key, range syntax, smoothing modes, meters, custom formatting. |
| [truce-toml](reference/truce-toml.md) | Project-level `truce.toml` schema: `[vendor]`, `[[plugin]]`, `[[suite]]`, packaging, signing. |
| [cargo-config](reference/cargo-config.md) | Per-developer `.cargo/config.toml` `[env]` table — every environment variable truce reads (signing identities, SDK paths, validator paths, hot-reload). |

## Formats

Truce compiles a single plugin crate into up to seven plugin formats, plus an app-mode [standalone](formats/standalone.md) binary. Scaffolded plugins enable `clap`, `vst3`, and `standalone` by default; everything else is opt-in.

| Format | Cargo feature | macOS | Windows | Linux | Scaffolded default | Extras required |
|--------|---------------|-------|---------|-------|--------------------|-----------------|
| [CLAP](formats/clap.md) | `clap` | ✅ | ✅ | ✅ | ✅ | — |
| [VST3](formats/vst3.md) | `vst3` | ✅ | ✅ | ✅ | ✅ | — |
| [VST2](formats/vst2.md) | `vst2` | ✅ | ✅ | ✅ | opt-in | read licensing note |
| [LV2](formats/lv2.md) | `lv2` | ✅ | ✅ | ✅ | opt-in | — |
| [AU v2](formats/au.md) | `au` | ✅ | — | — | opt-in | Xcode CLI tools |
| [AU v3](formats/au.md) | `au` | ✅ | — | — | opt-in | full Xcode, Developer ID signing |
| [AAX](formats/aax.md) | `aax` | ✅ | ✅ | — | opt-in | AAX SDK (+ PACE wraptool for retail) |
| [Standalone](formats/standalone.md) | `standalone` | ✅ | ✅ | ✅ | ✅ | — (app mode, not a host-loaded format) |

Two ways to enable an opt-in format. Per install: `cargo truce install --vst2` (one-off). Permanently: add it to `[features].default` in `Cargo.toml`.

### Install destinations

`cargo truce install` defaults to **per-user** paths on every platform. Pass `--system` for the system-wide directories (sudo on macOS, Administrator shell on Windows). AAX, AU v3, and Windows VST2 are always system-only — `--user` for those falls back to the system path with a one-line note (`†`).

| Format | macOS user | macOS system | Windows user | Windows system | Linux |
|--------|-----------|--------------|--------------|----------------|-------|
| CLAP   | `~/Library/Audio/Plug-Ins/CLAP/{Name}.clap` | `/Library/Audio/Plug-Ins/CLAP/{Name}.clap` | `%LOCALAPPDATA%\Programs\Common\CLAP\{Name}.clap` | `%COMMONPROGRAMFILES%\CLAP\{Name}.clap` | `~/.clap/{Name}.clap` |
| VST3   | `~/Library/Audio/Plug-Ins/VST3/{Name}.vst3/` | `/Library/Audio/Plug-Ins/VST3/{Name}.vst3/` | `%LOCALAPPDATA%\Programs\Common\VST3\{Name}.vst3\` | `%COMMONPROGRAMFILES%\VST3\{Name}.vst3\` | `~/.vst3/{Name}.vst3/` |
| VST2   | `~/Library/Audio/Plug-Ins/VST/{Name}.vst/` | `/Library/Audio/Plug-Ins/VST/{Name}.vst/` | system† | `%PROGRAMFILES%\Steinberg\VstPlugins\{Name}.dll` | `~/.vst/{Name}.so` |
| LV2    | `~/Library/Audio/Plug-Ins/LV2/{Name}.lv2/` | `/Library/Audio/Plug-Ins/LV2/{Name}.lv2/` | `%APPDATA%\LV2\{Name}.lv2\` | `%COMMONPROGRAMFILES%\LV2\{Name}.lv2\` | `~/.lv2/{Name}.lv2/` |
| AU v2  | `~/Library/Audio/Plug-Ins/Components/{Name}.component/` | `/Library/Audio/Plug-Ins/Components/{Name}.component/` | — | — | — |
| AU v3  | system† | `/Applications/{Name}.app/Contents/PlugIns/AUExt.appex/` | — | — | — |
| AAX    | system† | `/Library/Application Support/Avid/Audio/Plug-Ins/{Name}.aaxplugin/` | system† | `%COMMONPROGRAMFILES%\Avid\Audio\Plug-Ins\{Name}.aaxplugin\` | — |
| Standalone | `target/bundles/{Name}.standalone/` (staged by `cargo truce run`; not installed) | same | same | same | same |

`cargo truce install` is the supported way to land bundles in these dirs; the paths are listed here as a debug aid when plugins aren't being picked up. `cargo truce doctor` prints both scopes side-by-side with a writable / sudo / not-present marker.

## See also

- [Changelog](changelog.md) — what's shipped, plus the [backlog](changelog.md#backlog) of known gaps and what's next.
- [rustdoc](https://truce-audio.github.io/truce/) — the full Rust API surface, generated from `cargo doc`.
