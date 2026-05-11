# `cargo truce` CLI reference

Every `cargo truce` subcommand and the flags it accepts. For the narrative shape of the dev loop, see the [guide](../guide/); for per-format
gotchas, see [formats](../formats/).

## Conventions

- All build-producing subcommands (`new`, `install`, `build`, `package`, `run`, `screenshot`) default to the cargo **release** profile. Pass `--debug` for the cargo dev profile (faster compile, slower DSP).
- `-p <crate>` selects a single plugin in a workspace by its cargo crate name. Without `-p`, the command operates on every `[[plugin]]` in `truce.toml`.
- Format flags (`--clap`, `--vst3`, `--vst2`, `--lv2`, `--au2`, `--au3`, `--aax`) add to the active feature set for one invocation only — they don't modify `Cargo.toml`. Mix and match: `--clap --vst3 --lv2`.

## `new`

Scaffold a new plugin or workspace.

```sh
cargo truce new <name>                              # single-crate plugin
cargo truce new <name> --workspace <p1> <p2> ...    # workspace with N plugins
```

| Flag | Notes |
|------|-------|
| `--workspace <names...>` | Generate a Cargo workspace with one sub-crate per name. Shared `truce.toml`. |
| `--vendor <string>` | Vendor name. Default: placeholder ("My Company"). |
| `--vendor-id <reverse-dns>` | Vendor reverse-DNS prefix. Default: `com.mycompany`. |
| `--type:<crate>=<category>` | Per-plugin category in workspace mode (`effect`, `instrument`, `midi`). |
| `--no-standalone` | Skip the standalone host (drops `main.rs`, the bin entry, and the `standalone` feature). |

Scaffolded plugins enable `clap`, `vst3`, and `standalone` in `[features].default`.

## `install`

Build, bundle, and copy plugins into your local plug-in directories.

```sh
cargo truce install                       # every default-feature format
cargo truce install --clap                # one format
cargo truce install --clap --vst3 --lv2   # subset
```

| Flag | Notes |
|------|-------|
| `--clap` / `--vst3` / `--vst2` / `--lv2` / `--au2` / `--au3` / `--aax` | Enable the format for this run. |
| `--user` | Per-user paths (default on every platform; no `sudo`/admin). |
| `--system` | System-wide paths (`sudo` on macOS, Administrator shell on Windows). |
| `--shell` | Install the dynamic-shell build for hot reload. See [hot reload](../guide/hot-reload.md). |
| `--debug` | Cargo dev profile (faster compile, slower DSP). |
| `--no-build` | Install existing bundles from `target/bundles/`; skip rebuild. |
| `-p <crate>` | Single plugin in a workspace. |

AAX, AU v3, and Windows VST2 are always system-scope — `--user` for those falls back to system with a one-line `note`.

Per-platform install destinations: see [`formats/README`](../formats/) for the full table.

## `uninstall`

Remove installed plugins.

```sh
cargo truce uninstall                  # every format, both scopes
cargo truce uninstall --clap --user
cargo truce uninstall --au2 --au3 -p my-gain
cargo truce uninstall --stale --dry-run    # preview cleanup of bundles whose
                                           # source plugin is no longer in truce.toml
```

| Flag | Notes |
|------|-------|
| `--clap` / `--vst3` / `--vst2` / `--lv2` / `--au2` / `--au3` / `--aax` | Limit to one or more formats. |
| `--user` / `--system` | Limit to one scope. By default scans both (handy when you've switched scope mid-iteration). |
| `-p <crate>` | Single plugin in a workspace. |
| `-n <name>` | Target a bundle by display name when `truce.toml` no longer lists it. |
| `--stale` | Remove bundles whose `[[plugin]]` entry was deleted from `truce.toml`. |
| `--dry-run` | Print what would be removed without touching disk. |
| `--yes` | Skip the confirmation prompt. |

## `build`

Same bundle layout as `install`, but written to `target/bundles/<Plugin>.{clap,vst3,...}` instead of system plug-in directories. Useful for CI, packaging dry-runs, and inspecting artifacts.

```sh
cargo truce build                  # every default format
cargo truce build --clap --vst3    # subset
cargo truce build --au3            # AU v3 .app, fully signed
cargo truce build --aax            # AAX .aaxplugin, fully signed
cargo truce build --shell          # hot-reload shell build
cargo truce build --debug          # cargo dev profile
```

Every format flag produces a complete, signed bundle in `target/bundles/`.

## `run`

Build and launch the standalone host.

```sh
cargo truce run                    # default plugin
cargo truce run -p my-gain         # specific plugin in workspace
cargo truce run -- --help          # pass flags through to the binary
cargo truce run -- --list-devices  # standalone CLI flag
```

The standalone binary's own flags (`--output`, `--sample-rate`, `--input-file`, ...) live in [`formats/standalone`](../formats/standalone.md).

## `validate`

Run the free validators against your installed bundles.

```sh
cargo truce validate                    # every available validator (permissive)
cargo truce validate --all              # same as no flag
cargo truce validate --clap             # CLAP via clap-validator
cargo truce validate --pluginval        # VST3 via pluginval
cargo truce validate --auval            # AU v2 via auval (macOS)
cargo truce validate --auval3           # AU v3 via auval (macOS)
cargo truce validate --vst2             # VST2 dlopen + AEffect smoke
cargo truce validate --clap --pluginval -p my-gain
```

Strict mode for CI — any per-format flag (`--clap`, `--pluginval`, `--auval`, `--auval3`, `--vst2`) fails the run if its validator is missing:

| Invocation | Validator missing → |
|---|---|
| `cargo truce validate` (no flag) | warning, exit 0 |
| `cargo truce validate --all` | warning, exit 0 |
| `cargo truce validate --<format>` (any one) | error, exit non-zero |

Override validator discovery via env: `CLAP_VALIDATOR`, `PLUGINVAL` (see [`cargo-config`](cargo-config.md)).

## `package`

Produce a signed, distributable installer.

```sh
cargo truce package                          # every default format, universal arch, signed
cargo truce package -p my-gain               # single plugin
cargo truce package --formats clap,vst3,aax  # subset
```

| Flag | Notes |
|------|-------|
| `--formats <list>` | Comma-separated subset. Overrides `[packaging].formats` in `truce.toml`. |
| `--ask` | End user picks scope at install time (default — see `truce.toml` `[packaging].preferred_scope`). |
| `--user` | Hard-locked user-scope installer. |
| `--system` | Hard-locked system-scope installer. |
| `--host-only` | Skip the cross-arch build. Dev iteration. |
| `--no-sign` | Skip Authenticode / Developer ID signing. Dev only. |
| `--no-notarize` | macOS: sign but skip Apple notarization. |
| `--no-installer` | Windows: stage files but skip the Inno Setup compile step. |
| `--no-per-plugin` / `--no-suite` | Drop per-plugin or suite installers when both would otherwise be produced. |
| `-p <crate>` | Single plugin. |

Output: `target/dist/<Name>-<version>-{macos.pkg,windows.exe}`, with a `-user` / `-system` suffix when scope is hard-locked.

Defaults: universal architecture (macOS = fat Mach-O `x86_64` + `aarch64`; Windows = `x64` + `arm64` payloads).

Signing identities and notary credentials come from env (`TRUCE_SIGNING_IDENTITY`, `APPLE_ID`, `AZURE_TENANT_ID`, etc.) — see [`cargo-config`](cargo-config.md).

## `doctor`

Probe the host for build, signing, and validator dependencies.

```sh
cargo truce doctor
```

Reports — green = ready, yellow = optional, red = blocking — for each of:

- Rust toolchain version.
- Per-OS C/C++ compilers (Xcode CLI tools / VS Desktop C++ / `build-essential`).
- Full Xcode (for AU v3).
- Inno Setup `ISCC.exe` (Windows packaging).
- Vulkan / X11 / fontconfig (Linux GUI).
- `AAX_SDK_PATH` if set; PACE wraptool on `PATH`.
- `clap-validator`, `pluginval`, `auval` discovery.
- sccache (`RUSTC_WRAPPER`) detection.
- Per-format install paths per scope (writable / sudo / not-present marker).

Run `doctor` whenever a build behaves oddly — usually faster than reading the error.

## `screenshot`

Render a frame of the plugin's GUI to a PNG. Used by visual regression tests via the `truce_test::screenshot!` macro and ad-hoc for marketing assets.

```sh
cargo truce screenshot --out spectrum.png
cargo truce screenshot --out spectrum.png --state preset.state
cargo truce screenshot --out spectrum.png --check         # diff against on-disk reference
cargo truce screenshot --out spectrum.png --scale 2       # @2× retina render
```

| Flag | Notes |
|------|-------|
| `--out <path>` | Output PNG path. **Required.** |
| `--state <path>` | Load plugin state from a `.state` file before rendering. |
| `--check` | Diff against the existing file at `--out` instead of overwriting; fail on mismatch. |
| `--scale <n>` | DPI scale factor (1 / 2 / 3). |
| `-p <crate>` | Target plugin in a workspace. |

For the testing workflow, see [`gui/screenshot-testing`](../guide/gui/screenshot-testing.md).

## Cache resets

Hosts cache plugin metadata aggressively; truce ships escape hatches.

| Command | Use when |
|---------|----------|
| `cargo truce reset-au` | Logic / GarageBand / Ableton don't see your new AU build, or AU type/subtype IDs changed. Clears `AudioComponentRegistrar`. |
| `cargo truce reset-aax` | Pro Tools doesn't see your new AAX build. Clears Pro Tools' AAX cache. |
| `cargo truce log-stream-au` | Stream Apple's `pluginkit` / `auvaltool` system logs while loading an AU plugin — for diagnosing host-side load failures. |

Post-install AU cache invalidation is automatic on a successful `install`; these resets are for the rare cases where it isn't enough.
