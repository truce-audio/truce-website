# 10. Presets

Declare a presets directory once and every format truce builds
surfaces your factory presets in the host's preset browser - CLAP,
VST3, AU v2 and v3, and LV2. Users save their own presets through
the host as usual, third parties ship preset packs as plain zip
files, and you author libraries inside your own DAW: save presets
with the host's native UI and `cargo truce preset pull` converts
them into the factory library.

## Quick start: ship factory presets

1. Put `.preset` TOML files in `presets/` next to your crate. The
   first directory level is the category:

   ```
   my-synth/
   |-- Cargo.toml
   |-- truce.toml
   |-- src/
   `-- presets/
       |-- lead/
       |   `-- bright-saw.preset
       `-- pad/
           `-- warm-strings.preset
   ```

   Each file is human-readable TOML: a `name`, optional metadata
   (`author`, `comment`, `tags`, at most one `default = true` per
   library), and a `[params]` table keyed by your `Params`
   struct's field names (numeric param ids also work), with plain
   values:

   ```toml
   name = "Bright Saw"
   author = "Jane Doe"
   tags = ["lead", "saw"]

   [params]
   waveform  = 1
   cutoff    = 9500.0   # Hz
   resonance = 0.35
   ```

   Skip the `uuid` field - the first install stamps one. You
   rarely write these files by hand: `cargo truce preset pull`
   (below) generates them from presets you save in your DAW. See
   [`examples/truce-example-synth/presets/`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-synth/presets)
   for a complete library.

2. `cargo truce install`. The install pipeline validates the
   library (parseable TOML, unique uuids and display names, a
   single default) and emits the format-native preset files:
   native containers + runtime discovery for CLAP, the factory
   preset list for AU v2/v3, `.vstpreset` files in the OS preset
   locations for VST3, `pset:Preset` TTL in the LV2 bundle. Hosts
   pick them up on their next scan.

The directory is picked up automatically; set
`[plugin.presets]` `factory_dir` in `truce.toml` to use a
different path.

Anything your plugin persists is captured: presets wrap the same
state blob as session recall, so `[params]` plus your
`#[derive(State)]` extras round-trip identically. The `extra`
field carries the latter as base64 - another reason to author via
`pull` rather than by hand.

## Authoring presets in your DAW

Open your plugin in whatever host
you like, dial in a sound, and save it with the host's own
"Save Preset" action - Logic's preset menu, Reaper's preset
dropdown, the VST3 save dialog. Then harvest the results:

```sh
cargo truce preset pull -p my-synth
```

`pull` finds host-saved presets in the standard OS locations,
checks each one actually belongs to your plugin, and converts it
into a `.preset` TOML in your crate's `presets/` directory - with
a freshly minted uuid, params keyed by field name, and display
names in the comments:

```toml
[params]
cutoff    = 8200.0   # Filter Cutoff (Hz)
resonance = 0.62     # Filter Resonance
```

Move the file into a category directory, tweak the name or tags,
and the next `cargo truce install` ships it as a factory preset
in every format.

Iterating on an existing preset works the same way: load it from
the host's menu, tweak, save under the same name - `pull` updates
the existing `.preset` in place and keeps its identity, so saved
sessions that reference it don't break. (The file is regenerated,
so hand-written comments in it are replaced; pass `--new` to
always create a fresh preset instead.)

## Converting presets between formats

Every preset file truce produces wraps the same state blob, so
presets convert losslessly between formats for any truce plugin -
this doesn't work for other vendors' plugins, whose preset content
is opaque:

```sh
cargo truce preset convert "Bright Saw.aupreset" "Bright Saw.vstpreset"
```

This is how presets saved in one DAW move to another: convert
the files and place the results in the target format's preset
location.

## Preset packs

A pack is a zip of the library in every format, built with:

```sh
cargo truce preset export my-synth-pack.zip
```

Users install it with
`cargo truce preset import my-synth-pack.zip`, which places the
truce-native tree under the user preset root's `packs/` directory
(where CLAP discovery and the preset API find it). The zip also
carries `.vstpreset` / `.aupreset` trees to drop into the OS
preset folders for hosts that scan those.

## Where presets live

| Scope | Location |
|---|---|
| Factory | Inside the plugin bundle, written at install |
| User | Per-OS user directory (below) |
| Pack | `packs/<pack-name>/` under the user directory |

Per-OS user roots:

```
macOS    ~/Library/Audio/Presets/truce/<vendor>/<plugin>/
Windows  %APPDATA%\truce\<vendor>\<plugin>\presets\
Linux    $XDG_DATA_HOME/truce/<vendor>/<plugin>/presets/
```

The `truce/<vendor>/<plugin>` part is overridable with
`[plugin.presets]` `user_dir = "Acme/MySynth"` in `truce.toml`,
which resolves to `~/Library/Audio/Presets/Acme/MySynth/` on
macOS, `%APPDATA%\Acme\MySynth\` on Windows, and
`$XDG_DATA_HOME/truce/Acme/MySynth/` on Linux. Pick it
once, before first release - changing it later orphans presets
users have already saved. Full field reference in
[reference/truce-toml](../reference/truce-toml.md).

A preset keeps its identity (a uuid in its metadata) across
rename, recategorise, and scope moves, so host sessions that
reference a preset keep resolving after you reorganize your
library. A user preset with the same uuid as a factory preset
overrides it.

## Per-host notes

| Format | Where presets show up |
|---|---|
| CLAP | Host preset browser via the discovery factory. Bitwig indexes it today; Reaper's support is in its `7.6x+dev` builds. |
| VST3 | Host preset dropdown / browser (Reaper, Cubase, ...); subdirectory = category. |
| AU v2 | Plugin-window preset menu in Logic / GarageBand, served by the factory-presets property. |
| AU v3 | Same, on macOS and iOS (bundled in the embedded framework's `Presets/`). |
| LV2 | Host preset list (Ardour, Carla) from the bundle TTL. |
| Standalone | Native [Presets menu](/docs/formats/standalone#presets) (macOS / Windows) — Load / Previous / Next / Save / Save As, plus Cmd-S / Cmd-Shift-S (the whole interface on Linux). User presets save to the same location your DAW reads. |
| AAX | Not emitted yet. |
| VST2 | Not emitted yet. |

## CLI reference

```sh
cargo truce preset pull [-p <crate>] [--watch] [--new] [--category <c>]
cargo truce preset convert <in> <out>      # any format pair (truce plugins only)
cargo truce preset import <file|pack.zip>  # native file -> library, pack -> user packs
cargo truce preset export <pack.zip>       # library -> shareable per-format pack
cargo truce preset list                    # every preset across all scopes
cargo truce preset init                    # stamp uuids into hand-authored files
```

Formats by extension: `.preset` (authored TOML), `.trucepreset`,
`.vstpreset`, `.aupreset`, `.ttl` (LV2).

## Where next

- **[Chapter 12 → shipping](shipping.md)** - presets ride along
  with `cargo truce install`; packaging ships them to users.
