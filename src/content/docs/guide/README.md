# Guide

A walkthrough of building, iterating on, and shipping a truce plugin. Read top-to-bottom on first pass; return to specific chapters as needed. For look-up material — every CLI flag, every `#[param(...)]` key, every `truce.toml` field — see the [reference](../reference/).

> **Build profile.** Every `cargo truce` command (`install`, `build`, `package`, `run`, `screenshot`) defaults to the cargo **release** profile — plugins are typically loaded into a DAW where debug-build DSP can spike CPU under load. Pass `--debug` to opt into the cargo dev profile for fast-compile iteration.

| # | Chapter | What you get |
|---|---------|--------------|
| 1 | [install](install.md) | Rust + the platform compiler + `cargo install cargo-truce` + `cargo truce doctor`. CLAP+VST3 minimum-friction setup; AU/AAX/packaging deferred. |
| 2 | [first-plugin](first-plugin.md) | `cargo truce new`, a tour of the generated files, `install`, load in a DAW |
| 3 | [plugin-anatomy](plugin-anatomy.md) | `PluginLogic` trait, bus layouts, state persistence |
| 4 | [parameters](parameters.md) | `#[derive(Params)]`, smoothing patterns, meters. Attribute reference lives in [reference/params](../reference/params.md). |
| 5 | [processing](processing.md) | `process()` patterns for effects, MIDI, sample-accurate events, synths |
| 6 | [midi](midi.md) | Reading and emitting MIDI events; per-format support; testing MIDI plugins |
| 7 | [gui](gui.md) | Built-in GUI widgets + the alternative backends (egui, iced, Slint, raw window handle) |
| 8 | [hot-reload](hot-reload.md) | ~2 second edit → hear loop with `--shell` |
| 9 | [shipping](shipping.md) | `cargo truce install / build / validate / package`, signing, installers |

## See also

- [Reference](../reference/) — `cargo truce` CLI, `truce.toml`, env vars, `#[param(...)]`.
- [Formats](../formats/) — per-format pages (CLAP, VST3, VST2, LV2, AU, AAX) with install paths and gotchas.
- [GUI backends](gui/) — deep-dive guides for egui, iced, Slint, and raw-window-handle.
- [Built-in GUI reference](gui/built-in.md) — the `GridLayout` builder, every widget constructor, theming.
- [Audio testing](audio-testing.md) — `truce_test::PluginDriver` for in-process audio + MIDI tests.
- [Screenshot testing](gui/screenshot-testing.md) — visual regression tests for the GUI.
- [Changelog](../changelog.md) — what's shipped, plus the [backlog](../changelog.md#backlog) of what's next.
