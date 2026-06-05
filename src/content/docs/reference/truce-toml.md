# `truce.toml` reference

Every field `cargo truce` reads from your project's `truce.toml`,
grouped by table. The file lives at the project root alongside
`Cargo.toml` and is **tracked in git** — it carries project-level
facts only.

Per-developer credentials and machine-specific paths (signing
identities, AAX SDK location, notarization Apple ID / team ID,
Authenticode certs) live in `.cargo/config.toml`'s `[env]` table
or shell env vars instead. See
[`cargo-config`](cargo-config.md) for that surface.

## `[vendor]` — required

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | Human company name. Shows in DAWs, installers, Apps & Features. |
| `id` | string | yes | Reverse-DNS prefix (`com.mycompany`). Used for AU/VST3/CLAP IDs and Windows installer AppId. |
| `url` | string | no | Vendor website. Surfaced in the Windows installer "Publisher URL" field. |
| `au_manufacturer` | string | yes | Exactly 4 ASCII characters. AU manufacturer code — must be unique per vendor. |

## `[[plugin]]` — one per plugin, at least one required

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | Human name. Used for bundle filenames and DAW display names. |
| `bundle_id` | string | yes | Short lowercase, no-dash identifier. Used internally for bundle / extension reverse-DNS IDs (`com.{vendor}.{bundle_id}.au`), install plist filenames, and scratch paths. Not used at the CLI. |
| `crate` | string | yes | Cargo package name. CLI uses this for `-p <crate>`. Hyphens become underscores in built `.dll`/`.dylib`. |
| `category` | string | yes | `"effect"` / `"instrument"` / `"midi"`. Drives AU/VST3/CLAP category metadata. |
| `fourcc` | string | yes† | Exactly 4 ASCII chars. AU subtype + cross-format unique ID. |
| `au_type` | string | no | Override AU type. Defaults: `"aumu"` for instruments, `"aumi"` for midi / note-effects, `"aufx"` for effects. |
| `au_subtype` | string | no | Synonym for `fourcc`. `fourcc` wins if both are set. |
| `au3_subtype` | string | no | 4-char subtype for AU v3 only. Set if v2/v3 must differ. |
| `au_tag` | string | no | AU category tag. Defaults to `"Effects"`. Common: `"Synthesizer"`, `"Dynamics"`, `"EQ"`, `"MIDI"`. |
| `aax_category` | string | no | AAX category string (e.g. `"Delay"`, `"Reverb"`, `"EQ"`). Maps to `AAX_ePlugInCategory` in the AAX SDK. |
| `vst3_subcategory` | string | no | VST3 "Plugin Type Categories" secondary token. Without this, hosts like Cubase bucket the plugin under "Other". Values from the VST3 SDK list: `"Delay"`, `"Distortion"`, `"Dynamics"`, `"EQ"`, `"Filter"`, `"Mastering"`, `"Modulation"`, `"Pitch Shift"`, `"Restoration"`, `"Reverb"`, `"Surround"`, `"Analyzer"`, `"Tools"`. Wrapper emits `Fx\|<sub>` for effects, `Instrument\|<sub>` for instruments. |
| `{format}_name` | string | no | Per-format display-name override: `clap_name`, `vst3_name`, `vst2_name`, `au_name`, `au3_name`, `aax_name`, `lv2_name`. |
| `windows_icon` | string | no | Path to `.ico` (workspace-root-relative). Embedded as `RT_GROUP_ICON` in the standalone `.exe`. Distinct from `[windows.packaging] installer_icon` — that one's the Inno-wizard chrome; this one's the per-product app icon. |
| `macos_icon` | string | no | Path to `.icns` (workspace-root-relative). Copied into the standalone `.app`'s `Contents/Resources/` and referenced via `CFBundleIconFile`. Generate one with `iconutil -c icns <iconset>` from a directory of 16/32/128/256/512px (and `@2x`) PNGs. |

† One of `fourcc` / `au_subtype` is required.

Category to format-metadata mapping:

| `category` | CLAP features | VST3 category | AU type |
|------------|---------------|---------------|---------|
| `"effect"` | `audio-effect` | `Fx` | `aufx` |
| `"instrument"` | `instrument` | `Instrument\|Synth` | `aumu` |
| `"midi"` | `note-effect` | `Fx\|Event` | `aumi` |

`{format}_name` overrides the display name surfaced to hosts
while leaving bundle filenames, IDs, and install paths derived
from `name`. One exception: `au3_name` also overrides the
`/Applications/{au3_name}.app` install path so two AU v3 builds
(e.g. release and beta) can coexist.

## `[[suite]]` — optional, repeatable

Each entry produces one suite installer per platform that bundles
multiple `[[plugin]]` entries together. Per-plugin installers
still ship in parallel; use `--no-per-plugin` to drop them, or
`--no-suite` to drop the suite output.

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | Display name shown in the installer. |
| `bundle_id` | yes | Short identifier for the suite. |
| `plugins` | no | List of plugin `crate` or `bundle_id` strings to include. Omit for "all `[[plugin]]` entries". Mutually exclusive with `exclude_plugins`. |
| `exclude_plugins` | no | List of plugins to exclude from the otherwise-implicit "all". Mutually exclusive with `plugins`. |
| `formats` | no | Per-suite format restriction (intersected with each plugin's enabled formats). Omit for the union. |
| `version` | no | Suite-level version. Defaults to `[workspace.package].version`. |
| `description` | no | Display blurb in the installer welcome page (where supported). |

## `[macos.packaging]` — optional, macOS only

| Field | Default | Notes |
|-------|---------|-------|
| `notarize` | `false` | `true` → submit to Apple notary and staple. `--no-notarize` on the CLI skips it. The credentials it uses come from env (see [`cargo-config`](cargo-config.md)). |
| `welcome_html` | — | Path to HTML shown on the productbuild wizard's welcome page. |
| `license_html` | — | Path to HTML shown on the wizard's license page. |

There is no `[macos.signing]` table — signing identities are per-developer and live in env. See [`cargo-config.md` § macOS code signing](cargo-config.md#macos-code-signing).

## `[windows.packaging]` — optional, Windows only

Project-level installer appearance. Per-developer Authenticode
credentials live in env (see [`cargo-config`](cargo-config.md)).

| Field | Default | Notes |
|-------|---------|-------|
| `publisher` | `[vendor].name` | "Publisher" in installer and Apps & Features. |
| `publisher_url` | `[vendor].url` | Publisher URL in the installer. |
| `installer_icon` | — | Path to a `.ico` for the installer + uninstaller. |
| `welcome_bmp` | — | Path to a 164×314 `.bmp` for welcome/finish pages. |
| `license_rtf` | — | Path to `.rtf` or `.txt` license. |
| `app_id` | `{vendor.id}.{plugin.bundle_id}` | Inno Setup stable identifier. Only change on rename. |

## `[packaging]` — cross-platform

| Field | Default | Notes |
|-------|---------|-------|
| `formats` | plugin's default features | Formats to include when packaging. Valid: `clap`, `vst3`, `vst2`, `lv2`, `au2`, `au3`, `aax`, `standalone`. `--formats` on the CLI overrides. macOS `.pkg` and Windows Inno Setup both honour this; Linux's tarball pipeline ships every default-feature format unconditionally. |
| `preferred_scope` | `"ask"` | Project-wide default for `cargo truce package`. `"user"`, `"system"`, or `"ask"`. CLI flags (`--user` / `--system` / `--ask`) override. `cargo truce install` has no toml override — pass `--user` / `--system` per invocation. |

Welcome/license screens are OS-specific (macOS uses HTML, Windows
uses BMP + RTF) and live under their per-platform `[macos.packaging]`
/ `[windows.packaging]` tables.

## `[automation]` — optional

Tunes the sample-accurate parameter chunking layer (see
[parameters § Sample-accurate automation](../guide/parameters.md#sample-accurate-automation)).
Omit the whole table to accept defaults.

| Field | Default | Notes |
|-------|---------|-------|
| `min_subblock_samples` | `32` | Smallest sub-block size in samples. Events that would produce a shorter sub-block are coalesced (smoother target lands at `block_start` instead of the event sample). `1` for strict sample-accuracy. A value above the host's max block size disables splitting (smoothers behave as they did pre-0.52). |

```toml
[automation]
min_subblock_samples = 32
```

## Full example

```toml
[vendor]
name = "Acme Audio"
id = "com.acmeaudio"
url = "https://acmeaudio.example"
au_manufacturer = "Acme"

[macos.packaging]
notarize = true
welcome_html = "branding/welcome.html"
license_html = "branding/license.html"

[windows.packaging]
publisher = "Acme Audio, LLC"
installer_icon = "branding/installer.ico"
welcome_bmp = "branding/welcome.bmp"
license_rtf = "branding/license.rtf"

[packaging]
formats = ["clap", "vst3", "aax"]
preferred_scope = "ask"

[[plugin]]
name = "Acme Gain"
bundle_id = "gain"
crate = "acme-gain"
category = "effect"
fourcc = "AGn1"
au_tag = "Dynamics"

[[plugin]]
name = "Acme Synth"
bundle_id = "synth"
crate = "acme-synth"
category = "instrument"
fourcc = "ASy1"
au_tag = "Synthesizer"

[[suite]]
name = "Acme Studio"
bundle_id = "acme-studio"
description = "Gain and Synth in one installer."
```

## What's not here

These all used to be `truce.toml` fields and are now per-developer
env vars instead. Setting them in `truce.toml` does nothing; see
[`cargo-config`](cargo-config.md) for where they live.

- `[macos].aax_sdk_path` → `AAX_SDK_PATH`
- `[macos.signing].application_identity` → `TRUCE_SIGNING_IDENTITY`
- `[macos.signing].installer_identity` → `TRUCE_INSTALLER_SIGNING_IDENTITY`
- `[macos.packaging].apple_id` → `APPLE_ID`
- `[macos.packaging].team_id` → `TEAM_ID`
- `[windows].aax_sdk_path` → `AAX_SDK_PATH`
- `[windows.signing].azure_account` → `TRUCE_AZURE_ACCOUNT`
- `[windows.signing].azure_profile` → `TRUCE_AZURE_PROFILE`
- `[windows.signing].azure_dlib` → `TRUCE_AZURE_DLIB`
- `[windows.signing].sha1` → `TRUCE_CERT_SHA1`
- `[windows.signing].cert_store` → `TRUCE_CERT_STORE`
- `[windows.signing].pfx_path` → `TRUCE_PFX_PATH`
- `[windows.signing].timestamp_url` → `TRUCE_TIMESTAMP_URL`

The split keeps secrets and machine-specific paths out of the
tracked file.
