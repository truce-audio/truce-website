# LV2

LV2 is the open plugin standard that dominates Linux-native DAWs
(Ardour, Qtractor, Carla, Zrythm, Jalv) and is also supported by
Reaper and Bitwig on other platforms.

LV2 support lives in
[truce-extensions](https://github.com/truce-audio/truce-extensions),
not in truce itself: `truce-lv2` is the runtime wrapper linked into
your plugin (hand-rolled C bindings, no `lv2-sys`), and
`truce-format-lv2` is the helper `cargo truce` runs to render the TTL
and lay out the bundle. Match their `major.minor` to truce's.

## Status

Opt-in. Working on macOS, Windows, and Linux. Tested in Reaper;
other LV2 hosts (Ardour, Carla, Jalv, Zrythm) not yet validated
but expected to work.

## Enable

Depend on `truce-lv2` behind an `lv2` feature. `truce::plugin!`
already emits the LV2 export under `#[cfg(feature = "lv2")]`, so
nothing else in your crate changes. Add `"lv2"` to
`[features].default` to build it every time, or pass `--lv2`.

```toml
[features]
default = ["clap", "vst3", "lv2"]
lv2 = ["dep:truce-lv2"]

[dependencies]
truce-lv2 = { version = "7.0", optional = true }
```

Then install the helper wherever you build bundles:

```sh
cargo install truce-format-lv2
cargo truce doctor          # confirms the helper was found
cargo truce install --lv2
```

## Requirements

- `truce-format-lv2` on `PATH`. Without it `--lv2` is an error that
  says how to install it, and a plain build or install skips LV2 with
  a note. No SDK, no env vars, no external signing.

## Install paths

User-scope by default; pass `--system` for the system-wide path.

| Platform | User (default) | System (`--system`) |
|----------|----------------|---------------------|
| Linux    | `~/.lv2/{slug}.lv2/` | same (Linux is user-only) |
| macOS    | `~/Library/Audio/Plug-Ins/LV2/{slug}.lv2/` | `/Library/Audio/Plug-Ins/LV2/{slug}.lv2/` (sudo) |
| Windows  | `%APPDATA%\LV2\{slug}.lv2\` | `%COMMONPROGRAMFILES%\LV2\{slug}.lv2\` (admin) |

`{slug}` is the plugin name lowercased with hyphens (e.g. "Truce
Gain" → `truce-gain`). The slug lives in the bundle directory name,
the `.so` / `.dylib` / `.dll` filename, and the Turtle IRI
references in `manifest.ttl`. The slugging avoids the need for
percent-encoding in TTL IRIs and keeps strict LV2 hosts happy.

Bundle contents:

```
{slug}.lv2/
├─ manifest.ttl          (plugin URI, binary path, extensions)
├─ plugin.ttl            (port layout, parameter descriptors, UI type)
└─ {slug}.{so,dylib,dll} (the compiled plugin)
```

`truce-format-lv2` writes the TTL files on every install or package,
from the parameter metadata truce's derives record during the build,
so they don't need to be committed.

## Plugin URI

The plugin URI is `vendor.url` + `/lv2/` + `bundle_id`:

```
https://github.com/your-org/your-repo/lv2/my-plugin
```

With no `vendor.url` it falls back to `urn:truce:<bundle_id>`, but
lilv's reference loader prefers an HTTP URI, so set one before you
ship. Don't change `vendor.url` or `bundle_id` after release — the URI
is the LV2 host's identity for the plugin.

## Versions

LV2 has no major version and reads an odd minor or micro, or minor 0,
as a development release. truce maps your plugin version so versions
order across a major bump and every release reads as one:
`lv2:minorVersion` is `2 × (major × 256 + minor) + 2` and
`lv2:microVersion` is `2 × patch` (1.5.3 → 524.6). LV2 requires a
minor bump when port indices change, so a release that adds or
reorders parameters needs at least a minor version bump.

## Supported extensions

- **`lv2:AudioPort`** — audio in/out.
- **`atom:AtomPort` with `midi:MidiEvent`** — MIDI input/output as
  LV2 Atom messages.
- **`state:interface`** — preset save/restore via truce's
  `snapshot_into` / `load_state`.
- **UI types**:
  - Linux: `ui:X11UI` (GUI hosted directly on the parent X11 window
    ID).
  - macOS: `ui:CocoaUI` (GUI hosted on an `NSView`).
  - Windows: `ui:WindowsUI` (GUI hosted on an `HWND`).
- **`ui:idleInterface`** — drives `Editor::idle`, declared as an
  optional UI feature so hosts that check features call it.

## Signing

None. LV2 has no signing requirements on any platform. `cargo truce
package` still emits the bundle as part of the platform installer.

## Build / install / package

```sh
cargo truce install --lv2
cargo truce build --lv2
cargo truce package --formats lv2
```

## Validate

No first-party LV2 validator is wired into `cargo truce validate`
yet. For manual checking, Carla or Jalv will print any TTL parse
errors when they try to load the bundle:

```sh
carla   # Load from file… → select {slug}.lv2/
jalv 'https://your-uri/here'
```

## Hosts

| Host | Platform | Status |
|------|----------|--------|
| Reaper | Linux / macOS / Windows | primary testbed |
| Ardour | Linux | should work; not yet validated |
| Qtractor | Linux | should work; not yet validated |
| Carla (plugin host) | Linux | should work; not yet validated |
| Jalv (CLI host) | Linux | should work; not yet validated |
| Zrythm | Linux | should work; not yet validated |
| Bitwig Studio | any | LV2 support is nominal; prefer CLAP there |

## Gotchas

- **The audio layout must match the category.** The TTL declares
  audio ports from `category` (effect, analyzer and tool 2 in / 2 out,
  instrument 0 in / 2 out, `midi` none), and `truce-lv2` refuses to
  instantiate a plugin whose real layout differs rather than load it
  with shifted ports. An `instrument` or `midi` plugin therefore needs
  its own `bus_layouts()` instead of the default stereo effect layout.
- **No const parameter ranges or defaults.** A `range` or `default`
  given as a Rust `const` can't be written into the TTL;
  `truce-format-lv2` refuses it when packaging and names the parameter.
- **Port names are persisted.** Hosts save `lv2:symbol`s, which derive
  from parameter names (`Step 1 Level` → `Step_1_Level`), in sessions,
  so renaming a parameter breaks saved sessions.
- **Plugin URI is immutable**. Once a plugin ships, the URI is the
  handle by which hosts refer to it in saved sessions. Changing
  `vendor.url` or `bundle_id` will break every saved session using
  your plugin. Choose them carefully.
- **X11UI `widget` = parent window ID**. truce's X11UI reports the
  plugin's parent window as its own widget (rather than creating a
  distinct child). Works in Reaper, expected to work in Ardour /
  Jalv; stricter hosts may object and require a follow-up. Report
  bugs on [truce-extensions](https://github.com/truce-audio/truce-extensions/issues).
- **No MIDI 2.0**. LV2 Atom carries MIDI 1.0 byte streams. Plugins
  exposing MIDI 2.0 `EventBody` variants only see the MIDI 1.0
  mapping when loaded as LV2.
- **Editor-scheduled background tasks run on a separate instance**.
  LV2 loads the UI as its own module, so truce backs the editor with
  a distinct plugin instance from the DSP. A [background
  task](../guide/workers.md) scheduled from the editor therefore runs
  against that UI instance's params - fine for preparing data the same
  GUI reads, but it can't hand results to the audio thread's `#[skip]`
  state the way the single-instance formats (CLAP, VST3, AU) can. Tasks
  scheduled from `process()` are unaffected; they run on the DSP
  instance as normal.
- **Bundle slugs are case-insensitive**. `Truce Gain`, `TRUCE-gain`,
  and `truce gain` all produce the same slug `truce-gain`. If two
  plugins in the same project slug to the same name they will
  overwrite each other — differentiate by editing `bundle_id` /
  `name` in `truce.toml`.
