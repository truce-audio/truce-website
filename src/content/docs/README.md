# truce

Build audio plugins in Rust. CLAP, VST3, LV2, AU v2, AU v3, AAX, and
standalone — from a single crate, on macOS, Windows, and Linux.

## Quick start

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

Open your DAW, scan for plugins, load `MyPlugin`. For a chapter-by-chapter
walkthrough, follow the [Guide](guide/) from [install](guide/install.md)
through [shipping](guide/shipping.md).

## Docs

**[Guide](guide/)** — walkthrough

- 1. [Install](guide/install.md) — Rust + platform compiler + `cargo truce doctor`
- 2. [First plugin](guide/first-plugin.md) — scaffold and load in a DAW
- 3. [Plugin anatomy](guide/plugin-anatomy.md) — `PluginLogic`, bus layouts, state
- 4. [Parameters](guide/parameters.md) — `#[derive(Params)]`, smoothing, meters
- 5. [Processing](guide/processing.md) — `process()` patterns for effects and synths
- 6. [MIDI](guide/midi.md) — read and emit events; per-format support
- 7. [GUI](guide/gui.md) — built-in widgets + alternative backends
- 8. [Hot reload](guide/hot-reload.md) — `--shell` and the ~2 s edit loop
- 9. [Shipping](guide/shipping.md) — signing, installers, validation

**[GUI backends](guide/gui/)** — pick your toolkit

- [Built-in widgets](guide/gui/built-in.md)
- [egui](guide/gui/egui.md)
- [iced](guide/gui/iced.md)
- [Slint](guide/gui/slint.md)
- [Raw window handle](guide/gui/raw-window-handle.md)
- [Screenshot testing](guide/gui/screenshot-testing.md)

**[Reference](reference/)**

- [`cargo truce`](reference/cli.md)
- [`#[param(...)]`](reference/params.md)
- [`truce.toml`](reference/truce-toml.md)
- [Cargo config](reference/cargo-config.md)

**[Formats](formats/)** — per-format install paths and gotchas

- [CLAP](formats/clap.md) · [VST3](formats/vst3.md) · [VST2](formats/vst2.md) · [LV2](formats/lv2.md) · [AU](formats/au.md) · [AAX](formats/aax.md) · [Standalone](formats/standalone.md)

**Advanced**

- [Audio testing](guide/audio-testing.md) — `truce_test::PluginDriver` for in-process audio + MIDI tests

**[Changelog](changelog.md)** — release notes, plus the [backlog](changelog.md#backlog) of known gaps and what's next
