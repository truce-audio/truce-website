# Reference

Look-up material for the most-touched parts of truce. Not exhaustive — for the full Rust API surface, see the [rustdoc](https://truce-audio.github.io/truce/). For learning the framework end-to-end, start with the [guide](../guide/).

| Page | What's in it |
|------|--------------|
| [cli](cli.md) | Every `cargo truce` subcommand and flag — `new`, `install`, `build`, `validate`, `package`, `run`, `doctor`, `uninstall`, `screenshot`. |
| [params](params.md) | `#[derive(Params)]` and `#[param(...)]` — every attribute key, range syntax, smoothing modes, meters, custom formatting. |
| [truce-toml](truce-toml.md) | Project-level `truce.toml` schema. `[vendor]`, `[[plugin]]`, `[[suite]]`, packaging, signing. |
| [cargo-config](cargo-config.md) | Per-developer `.cargo/config.toml` `[env]` table — every environment variable truce reads (signing identities, SDK paths, validator paths, hot-reload). |

## See also

- [Guide](../guide/) — install, first plugin, parameters, processing, MIDI, GUI, hot reload, shipping.
- [Formats](../formats/) — per-format pages (CLAP, VST3, VST2, LV2, AU, AAX) with install paths and gotchas.
- [rustdoc](https://truce-audio.github.io/truce/) — the full Rust API surface, generated from `cargo doc`.
