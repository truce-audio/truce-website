# `cargo truce` CLI reference

Every `cargo truce` subcommand and the flags it accepts. For the narrative shape of the dev loop, see the [guide](../#guide); for per-format
gotchas, see [formats](../#formats).

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
| `--instrument` | Scaffold an instrument (no audio input). Default is an effect. |
| `--midi` | Scaffold a MIDI effect. |
| `--stateful` | Scaffold `PluginLogic` where the plugin struct is its own DSP state (`type DspState = Self`), with the `state` argument pre-wired. **The default.** |
| `--pure` | Scaffold the stateless `PurePluginLogic` - no DSP state, no `state` argument. |
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
| `--target-cpu <value>` | Override the x86_64 SIMD baseline. See [`--target-cpu`](#--target-cpu) below. |

AAX, AU v3, and Windows VST2 are always system-scope — `--user` for those falls back to system with a one-line `note`.

Per-platform install destinations: see [`formats/README`](../#formats) for the full table.

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
cargo truce build --target-cpu v4  # AVX-512 baseline (x86_64)
```

Every format flag produces a complete, signed bundle in `target/bundles/`.

### `--target-cpu`

Override the SIMD baseline the build targets. Threaded into
`RUSTFLAGS=-C target-cpu=<value>` so `truce_simd`'s compile-time
`cfg(target_feature)` dispatch picks the right `f32x8` / `f32x16`
path. Applied per cargo target triple, so the same setting is safe
for multi-arch invocations (the x86 setting never leaks onto an
aarch64 slice of a universal macOS build, and vice versa).

Accepted values:

| Value | Expands to | Notes |
|-------|------------|-------|
| *(omitted)* | `x86-64-v3` on x86_64; nothing on aarch64 | Default. AVX2 + FMA + BMI2 — the floor modern DAW hosts already require, so the perf win is free in practice. |
| `baseline` | *(no flag passed)* | rustc's base target (`x86-64` on x86_64 = SSE2-only). Use when you need maximum CPU compatibility. |
| `v2` | `x86-64-v2` | SSE4.2 baseline. |
| `v3` | `x86-64-v3` | Same as the default; spell it out when scripting. |
| `v4` | `x86-64-v4` | AVX-512 baseline. |
| `native` | `native` | Local dev only — the resulting binary won't run on machines without the build host's exact feature set. |
| Any other literal | passed verbatim | e.g. `apple-m1`, `znver4`. Anything rustc accepts. |

aarch64 builds always emit NEON (it's the ARMv8 baseline); the
flag is a no-op there unless you pass a CPU-specific value like
`apple-m1`.

The flag is accepted by `install`, `build`, `package`, and `run`
with identical semantics.

## `run`

Build and launch the standalone host.

```sh
cargo truce run                    # default plugin
cargo truce run -p my-gain         # specific plugin in workspace
cargo truce run -- --help          # pass flags through to the binary
cargo truce run -- --list-devices  # standalone CLI flag
```

The standalone is built `--no-default-features` — no format wrapper is
needed to preview a plugin. Use `--features` to enable extras alongside
`standalone` (a format, or a plugin-specific feature).

| Flag | Notes |
|------|-------|
| `--features <list>` | Extra cargo features (comma- or space-separated) enabled alongside `standalone`. |
| `--no-build` | Skip rebuild; run the existing staged binary. |
| `--debug` | Cargo dev profile (faster compile, slower DSP). |
| `--target-cpu <value>` | Same semantics as [`build`](#--target-cpu). |
| `-- <args>` | Pass everything after `--` to the standalone binary. |

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
| `--target-cpu <value>` | Same semantics as [`build`](#--target-cpu). |

Output: `target/dist/<Name>-<version>-{macos.pkg,windows.exe}` (with a `-user` / `-system` suffix when scope is hard-locked) or `target/dist/<bundle_id>-<version>-linux-<arch>.tar.gz` on Linux.

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

## `preset`

Preset library management, format conversion, and the in-DAW authoring round-trip. See the [presets guide](../guide/presets.md) for the authoring workflow.

```sh
cargo truce preset list    [-p <crate>]
cargo truce preset init    [-p <crate>]
cargo truce preset convert <in> <out> [-p <crate>]
cargo truce preset import  <file|pack.zip> [--category <c>] [-p <crate>]
cargo truce preset export  <out.zip> [-p <crate>]
cargo truce preset pull    [--category <c>] [--new] [--watch] [-p <crate>]
```

| Subcommand | Notes |
|------------|-------|
| `list` | Every preset across factory (authored library), user, and pack scopes. |
| `init` | Stamp uuids into hand-authored `.preset` files. |
| `convert <in> <out>` | Re-envelope a preset between any two native formats — every container wraps the same canonical state blob (truce plugins only). |
| `import <file>` | One native preset file into the authored library as `.preset` TOML, or a `.zip` pack into the user pack directory. |
| `export <out.zip>` | The authored library as a shareable pack of per-format native files. |
| `pull [--watch]` | Harvest host-saved presets from the OS preset locations into the authored library — the DAW's own "save preset" UI becomes the authoring frontend. `--watch` keeps harvesting as you save. |

Formats are recognized by extension: `.preset` (authored TOML), `.trucepreset`, `.vstpreset`, `.aupreset`, `.ttl` (LV2).

## Cache resets

Hosts cache plugin metadata aggressively; truce ships escape hatches.

| Command | Use when |
|---------|----------|
| `cargo truce reset-au` | Logic / GarageBand / Ableton don't see your new AU build, or AU type/subtype IDs changed. Clears `AudioComponentRegistrar`. |
| `cargo truce reset-aax` | Pro Tools doesn't see your new AAX build. Clears Pro Tools' AAX cache. |
| `cargo truce log-stream-au` | Stream Apple's `pluginkit` / `auvaltool` system logs while loading an AU plugin — for diagnosing host-side load failures. |

Post-install AU cache invalidation is automatic on a successful `install`; these resets are for the rare cases where it isn't enough.
