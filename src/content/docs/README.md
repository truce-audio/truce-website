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

Open your DAW, scan for plugins, load `MyPlugin`. For a chapter-by-chapter walkthrough, follow the [Guide](#guide) from [install](guide/install.md) through [hot reload](guide/hot-reload.md). For look-up material — every CLI flag, every `#[param(...)]` key, every `truce.toml` field — jump to the [Reference](#reference). For working code to read top-to-bottom, browse the [Examples](#examples).

> **Build profile.** Every `cargo truce` command (`install`, `build`, `package`, `run`, `screenshot`) defaults to the cargo **release** profile — plugins are typically loaded into a DAW where debug-build DSP can spike CPU under load. Pass `--debug` to opt into the cargo dev profile for fast-compile iteration.

## Guide

A walkthrough of building, iterating on, and shipping a truce plugin. Read top-to-bottom on first pass; return to specific chapters as needed.

| # | Chapter | What you get |
|---|---------|--------------|
| 1 | [install](guide/install.md) | Rust + the platform compiler + `cargo install cargo-truce` + `cargo truce doctor`. CLAP+VST3 minimum-friction setup; AU/AAX/packaging deferred. |
| 2 | [first-plugin](guide/first-plugin.md) | `cargo truce new`, a tour of the generated files, `install`, load in a DAW. |
| 3 | [plugin-anatomy](guide/plugin-anatomy.md) | `PluginLogic` trait, bus layouts, state persistence. |
| 4 | [parameters](guide/parameters.md) | `#[derive(Params)]`, smoothing patterns, meters. Attribute reference in [reference/params](reference/params.md). |
| 5 | [processing](guide/processing.md) | `process()` patterns for effects, MIDI, sample-accurate events, synths. Includes the `truce_simd` per-block ops + math helpers for hot paths. |
| 6 | [fundsp](guide/fundsp.md) | Drop a `fundsp` graph into `process()` — combinator DSL, `Shared` cells for sample-accurate automation, RT60 rebuild patterns. |
| 7 | [midi](guide/midi.md) | Reading and emitting MIDI events; per-format support; testing MIDI plugins. |
| 8 | [gui](guide/gui.md) | Built-in GUI widgets + the alternative backends (egui, iced, Slint, Vizia, raw window handle). |
| 9 | [audio-testing](guide/audio-testing.md) | `truce_test::PluginDriver` for in-process audio + MIDI regression tests — no DAW required. |
| 10 | [shipping](guide/shipping.md) | `cargo truce install / build / validate / package`, signing, installers. |
| 11 | [ios](guide/ios.md) | iOS-specific workflow: simulator iteration, device + `.ipa` signing, per-plugin `truce.toml` knobs, preview-audio mute, screenshot regression. |
| 12 | [hot-reload](guide/hot-reload.md) | ~2 second edit → hear loop with `--shell`. Experimental — dev-loop only. |

### GUI backends

Pick a toolkit. The built-in widget set covers most plugin UIs; the alternatives are there when you need something the built-in widgets don't ship.

- [Built-in widgets](guide/gui/built-in.md) — `GridLayout` builder, every widget constructor, theming
- [egui](guide/gui/egui.md) · [iced](guide/gui/iced.md) · [Slint](guide/gui/slint.md) · [Vizia](guide/gui/vizia.md) · [Raw window handle](guide/gui/raw-window-handle.md)
- [Screenshot testing](guide/gui/screenshot-testing.md) — visual regression tests for the GUI

## Reference

Not exhaustive — for the full Rust API surface, see the [rustdoc](https://truce-audio.github.io/truce/).

| Page | What's in it |
|------|--------------|
| [cli](reference/cli.md) | Every `cargo truce` subcommand and flag — `new`, `install`, `build`, `validate`, `package`, `run`, `doctor`, `uninstall`, `screenshot`. |
| [params](reference/params.md) | `#[derive(Params)]` and `#[param(...)]` — every attribute key, range syntax, smoothing modes, meters, custom formatting. |
| [truce-toml](reference/truce-toml.md) | Project-level `truce.toml` schema: `[vendor]`, `[[plugin]]`, `[[suite]]`, packaging. Signing identities and other secrets live in env — see [`cargo-config`](reference/cargo-config.md). |
| [cargo-config](reference/cargo-config.md) | Per-developer `.cargo/config.toml` `[env]` table — every environment variable truce reads (signing identities, SDK paths, validator paths, hot-reload). |

## Examples

Short, one-file plugin examples that double as canonical references
for parameter shapes, processing patterns, GUI layouts, and MIDI.
Full list with screenshots: [examples](examples/README.md).

| Plugin | Type | GUI | What it shows |
|--------|------|-----|---------------|
| [gain](examples/gain.md) | Effect | Built-in | Minimal plugin: one `FloatParam`, a single-channel multiply. |
| [eq](examples/eq.md) | Effect | Built-in | Multi-band biquad EQ with smoothed coefficients. |
| [synth](examples/synth.md) | Instrument | Built-in | MIDI-driven polyphonic synth with per-voice envelopes. |
| [transpose](examples/transpose.md) | MIDI | Built-in | MIDI effect — rewrite note numbers in `process()`. |
| [arpeggio](examples/arpeggio.md) | MIDI | Built-in | Sample-accurate MIDI scheduling against the host transport. |
| [tremolo](examples/tremolo.md) | Effect | egui | Tempo-synced LFO + the egui backend wired in. |
| [state](examples/state.md) | Effect | egui | Custom `#[derive(State)]` for persistent extra state. |
| [fundsp-reverb-simple](examples/fundsp-reverb-simple.md) | Effect | Built-in | Stereo plate reverb on a fundsp graph (pedagogical, inline rebuild). |
| [fundsp-reverb-worker](examples/fundsp-reverb-worker.md) | Effect | Built-in | Same reverb with a background-thread graph rebuild + lock-free swap — `process()` stays alloc-free. |
| [gain-egui](examples/gain-egui.md) | Effect | egui | Same plugin as `gain`, rendered with [egui](https://github.com/emilk/egui). |
| [gain-iced](examples/gain-iced.md) | Effect | Iced | Same plugin, rendered with [Iced](https://github.com/iced-rs/iced). |
| [gain-slint](examples/gain-slint.md) | Effect | Slint | Same plugin, rendered with [Slint](https://slint.dev/). |
| [gain-vizia](examples/gain-vizia.md) | Effect | Vizia | Same plugin, rendered with [Vizia](https://github.com/vizia/vizia). |

The five `gain*` variants implement the same plugin against
different GUI frameworks — compare them side-by-side to pick a
toolkit. The two `fundsp-reverb-*` crates share a topology and
signal flow but differ only in *how* the fundsp graph gets
rebuilt; [chapter 6 → fundsp](guide/fundsp.md) walks through both.

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
| [AU v3 (iOS)](formats/au-ios.md) | `au` | ✅ (iOS) | — | — | opt-in | Xcode, Apple Developer team ID for device / `.ipa` |
| [AAX](formats/aax.md) | `aax` | ✅ | ✅ | — | opt-in | AAX SDK (+ PACE wraptool for retail) |
| [Standalone](formats/standalone.md) | `standalone` | ✅ | ✅ | ✅ | ✅ | — (app mode, not a host-loaded format) |

Two ways to enable an opt-in format. Per install: `cargo truce install --vst2` (one-off). Permanently: add it to `[features].default` in `Cargo.toml`.

### Install destinations

`cargo truce install` defaults to **per-user** paths on every platform — no sudo / Administrator prompt. Pass `--system` for the system-wide directories (sudo on macOS, Administrator shell on Windows). AAX, AU v3, and Windows VST2 are always system-only — `--user` for those falls back to the system path with a one-line note (`†`). Linux is user-scope only: `--user` and `--system` resolve to the same paths every Linux host already scans.

The **bold** cell in each row is the destination `cargo truce install` lands at by default (no flag). Other cells are reached by passing `--system` (or, for system-only formats, by passing `--system` explicitly so the `†` fallback note is suppressed).

| Format | macOS user | macOS system | Windows user | Windows system | Linux |
|--------|-----------|--------------|--------------|----------------|-------|
| CLAP   | **`~/Library/Audio/Plug-Ins/CLAP/{Name}.clap`** | `/Library/Audio/Plug-Ins/CLAP/{Name}.clap` | **`%LOCALAPPDATA%\Programs\Common\CLAP\{Name}.clap`** | `%COMMONPROGRAMFILES%\CLAP\{Name}.clap` | **`~/.clap/{Name}.clap`** |
| VST3   | **`~/Library/Audio/Plug-Ins/VST3/{Name}.vst3/`** | `/Library/Audio/Plug-Ins/VST3/{Name}.vst3/` | **`%LOCALAPPDATA%\Programs\Common\VST3\{Name}.vst3\`** | `%COMMONPROGRAMFILES%\VST3\{Name}.vst3\` | **`~/.vst3/{Name}.vst3/`** |
| VST2   | **`~/Library/Audio/Plug-Ins/VST/{Name}.vst/`** | `/Library/Audio/Plug-Ins/VST/{Name}.vst/` | system† | **`%PROGRAMFILES%\Steinberg\VstPlugins\{Name}.dll`** | **`~/.vst/{Name}.so`** |
| LV2    | **`~/Library/Audio/Plug-Ins/LV2/{Name}.lv2/`** | `/Library/Audio/Plug-Ins/LV2/{Name}.lv2/` | **`%APPDATA%\LV2\{Name}.lv2\`** | `%COMMONPROGRAMFILES%\LV2\{Name}.lv2\` | **`~/.lv2/{Name}.lv2/`** |
| AU v2  | **`~/Library/Audio/Plug-Ins/Components/{Name}.component/`** | `/Library/Audio/Plug-Ins/Components/{Name}.component/` | — | — | — |
| AU v3  | system† | **`/Applications/{Name}.app/Contents/PlugIns/AUExt.appex/`** | — | — | — |
| AAX    | system† | **`/Library/Application Support/Avid/Audio/Plug-Ins/{Name}.aaxplugin/`** | system† | **`%COMMONPROGRAMFILES%\Avid\Audio\Plug-Ins\{Name}.aaxplugin\`** | — |
| Standalone | `target/bundles/{Name}.standalone/` (staged by `cargo truce run`; not installed) | same | same | same | same |

`cargo truce install` is the supported way to land bundles in these dirs; the paths are listed here as a debug aid when plugins aren't being picked up. `cargo truce doctor` prints both scopes side-by-side with a writable / sudo / not-present marker. End-to-end packaging and `--ask` / `--user` / `--system` installer scope live in [guide/shipping](guide/shipping.md).

## See also

- [Changelog](changelog.md) — what's shipped, plus the [backlog](changelog.md#backlog) of known gaps and what's next.
- [rustdoc](https://truce-audio.github.io/truce/) — the full Rust API surface, generated from `cargo doc`.
