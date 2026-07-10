# 2. Your first plugin

Scaffold, build, install, load, iterate. End state: a stereo gain
plugin with a GUI loaded in your DAW.

Prerequisites: [chapter 1 → install](install.md).

## Scaffold

```sh
cargo truce new my-gain
cd my-gain
```

`cargo truce new` writes a minimal, self-contained project:

```
my-gain/
├── Cargo.toml       crate with cdylib crate-type + default clap/vst3/standalone features
├── truce.toml       vendor identity + this plugin's metadata (name, IDs, AU codes)
└── src/
    ├── lib.rs       the whole plugin — params, DSP, GUI, export macro
    └── main.rs      standalone host entry point (gated behind the `standalone` feature)
```

No `build.rs`. No separate GUI crate. The `src/main.rs` host is a
4-line `truce_standalone::run::<Plugin>()` call so `cargo truce run`
works out of the box; pass `--no-standalone` to skip it (drops the
file, the bin entry, and the `standalone` feature/dep).

**Shipping a suite?** Pass `--workspace` to create one Cargo workspace
with a shared `truce.toml` and one sub-crate per plugin:

```sh
cargo truce new studio --workspace gain reverb delay
cargo truce new studio --workspace gain synth arp \
    --vendor "Studio Audio" --vendor-id com.studio \
    --type:synth=instrument --type:arp=midi
cargo truce new studio --workspace gain reverb \
    --no-standalone                            # skip the standalone host in every plugin
```

You get `studio/plugins/{gain,synth,arp}/`, each with its own
`lib.rs` (and `main.rs` unless you passed `--no-standalone`), plus
one `truce.toml` with three `[[plugin]]` entries. Every `cargo truce`
command below works workspace-wide; add `-p <crate>` (the cargo
crate name, e.g. `-p gain`) to target one plugin.

## Tour the generated code

`src/lib.rs` has three parts. Open it alongside this section.

### 1. Parameters — what the user controls

```rust
#[derive(Params)]
pub struct MyGainParams {
    #[param(name = "Gain", range = "linear(-60, 6)",
            unit = "dB", smooth = "exp(5)")]
    pub gain: FloatParam,
}
```

One line of attributes per parameter. `#[derive(Params)]` generates
a `MyGainParamsParamId` enum with typed
variants, and the `Params` trait impl. Parameter IDs auto-assign by
field order (`Gain = 0`, then 1, 2, ...). See
[chapter 4 → parameters](parameters.md) for the full attribute
reference.

### 2. Plugin logic — what happens to the audio

```rust
use MyGainParamsParamId as P;

pub struct MyGain;

impl PurePluginLogic for MyGain {
    type Params = MyGainParams;

    fn process(params: &MyGainParams, buffer: &mut AudioBuffer,
               _events: &EventList, _ctx: &mut ProcessContext) -> ProcessStatus {
        for i in 0..buffer.num_samples() {
            let gain = db_to_linear(params.gain.read());
            for ch in 0..buffer.channels() {
                let (inp, out) = buffer.io(ch);
                out[i] = inp[i] * gain;
            }
        }
        ProcessStatus::Normal
    }

    fn editor(params: Arc<MyGainParams>) -> Box<dyn Editor> {
        use truce_gui::IntoLayoutEditor;
        use truce_gui_types::layout::{GridLayout, knob, widgets};
        GridLayout::build(vec![widgets(vec![knob(P::Gain, "Gain")])])
            .into_editor(&params)
    }
}
```

A gain keeps no per-instance state between blocks, so `MyGain`
implements `PurePluginLogic` - the stateless leaf trait. That means
no `type DspState`, no `init`, and no `state` argument threaded
through `process`: the method is a pure function of params and input.
`process()` runs every block on the audio thread; `editor()` returns
the GUI on the main thread. Those two are the only required methods -
the shell snaps the parameter smoothers for you, so a pure plugin
needs no `reset` either.

A plugin that *does* keep DSP state (filter memory, a delay line, an
oscillator phase) implements `PluginLogic` instead and names that
state as `type DspState`. See
[chapter 3 → plugin-anatomy](plugin-anatomy.md).

### 3. The export macro — makes it a plugin

```rust
truce::plugin! {
    logic: MyGain,
    params: MyGainParams,
}
```

Generates all format entry points (CLAP, VST3, VST2, LV2, AU v2/v3,
AAX via Cargo features), state serialization, parameter hosting,
and the hot-reload shell. One macro. Default bus layout is stereo and
mono (so the effect shows up on both mono and stereo tracks); override
`PluginLogic::bus_layouts()` for instruments, sidechains, or a
stereo-only effect.

## Tour the generated config

### `truce.toml`

```toml
[vendor]
name = "My Company"
id = "com.mycompany"
au_manufacturer = "MyCo"

[[plugin]]
name = "My Gain"
bundle_id = "my-gain"
crate = "my-gain"
category = "effect"
fourcc = "MyG1"
```

`truce.toml` is the single source of truth for plugin identity
across every format. The `truce::plugin_info!()` macro reads it at
compile time so `truce::plugin!` doesn't need any of this in code.
Full schema in
[`reference/truce-toml`](../reference/truce-toml.md).

Per-developer secrets (signing identity, AAX SDK path, notary
credentials) go in `.cargo/config.toml` (gitignored), **not** here.

### `Cargo.toml` features

```toml
[features]
default = ["clap", "vst3", "standalone"]
clap       = ["truce/clap"]
vst3       = ["truce/vst3"]
vst2       = ["truce/vst2"]
lv2        = ["truce/lv2"]
au         = ["truce/au"]
aax        = ["truce/aax"]
standalone = ["truce/standalone"]
shell      = ["truce/shell"]
```

Scaffolded plugins enable CLAP + VST3 + standalone by default. Add more formats
to `default`, or opt in per-command (`cargo truce install --vst2`).
Per-format detail (SDKs, env vars, install paths, signing) is in
[docs/formats/](../#formats).

## Build and install

```sh
cargo truce install
```

This builds the crate, bundles each enabled format, codesigns on
macOS, and drops bundles into your **per-user** plug-in directories.
You should see something like:

```
CLAP: ~/Library/Audio/Plug-Ins/CLAP/My Gain.clap
VST3: ~/Library/Audio/Plug-Ins/VST3/My Gain.vst3
```

No `sudo` / Administrator prompt — user-scope is the default on
every platform. Pass `--system` to install into the system-wide
plug-in directories (`/Library/Audio/Plug-Ins/...` on macOS,
`%COMMONPROGRAMFILES%\...` on Windows), which prompts for sudo /
admin once per run.

Defaults to the cargo release profile — installing usually means
audio-testing in a DAW, where debug-build DSP can CPU-spike under
load. Pass `--debug` for fast-compile iteration when DSP correctness
isn't what you're checking; never ship a `--debug` bundle.

Explicit format selection works too:

```sh
cargo truce install --clap
cargo truce install --vst3 --lv2
cargo truce install --system          # system-scope install (sudo / admin)
```

Install destinations per platform live in
[docs/formats/README](../formats/README.md).

To stage bundles into `target/bundles/` without writing to the
system plug-in directories — useful for CI, packaging dry-runs, or
just inspecting the produced artifact — use `cargo truce build`:

```sh
cargo truce build              # all default-feature formats
cargo truce build --clap       # one format
cargo truce build --debug      # cargo dev profile (faster compile)
```

Same defaults as `install`, same `--debug` opt-in, but never touches
host plug-in paths.

## Load in a DAW

1. Open your DAW (Reaper is a good first test — free trial, loads
   CLAP / VST3 / VST2 / LV2).
2. Rescan plugins (Reaper: `Options → Preferences → Plug-ins →
   VST/CLAP → Re-scan`).
3. Insert **My Gain** on a track.
4. Play audio; drag the knob. Volume should change.

Expected:

![Scaffolded my-gain plugin: a single Gain knob reading 0.0 dB](/screenshots/my-gain/default.png)

(Rendered headlessly with `cargo truce screenshot --out screenshots/default.png`
— the same path the screenshot regression tests in
[gui/screenshot-testing](gui/screenshot-testing.md) use.)

## Edit and rebuild

Add a pan parameter. In `src/lib.rs`:

```rust
#[derive(Params)]
pub struct MyGainParams {
    #[param(name = "Gain", range = "linear(-60, 6)",
            unit = "dB", smooth = "exp(5)")]
    pub gain: FloatParam,

    #[param(name = "Pan", range = "linear(-1, 1)",
            unit = "pan", smooth = "exp(5)")]
    pub pan: FloatParam,
}
```

Use it in `process()`:

```rust
for i in 0..buffer.num_samples() {
    let gain = db_to_linear(params.gain.read());
    let pan  = params.pan.read();
    let l = gain * (1.0 - pan.max(0.0));
    let r = gain * (1.0 + pan.min(0.0));
    buffer.output(0)[i] *= l;
    if buffer.num_output_channels() >= 2 {
        buffer.output(1)[i] *= r;
    }
}
```

Show it in the GUI:

```rust
fn editor(params: Arc<MyGainParams>) -> Box<dyn Editor> {
    GridLayout::build(vec![widgets(vec![
        knob(P::Gain, "Gain"),
        knob(P::Pan,  "Pan"),
    ])])
    .into_editor(&params)
}
```

Rebuild:

```sh
cargo truce install
```

Close and reopen the plugin in your DAW. You now have two knobs.

## What's next

- **Other parameter kinds** — boolean, int, enum, groups, meters,
  custom formatting → [chapter 4 → parameters](parameters.md).
- **Non-trivial processing** — transport, sample-accurate events,
  instruments → [chapter 5 → processing](processing.md).
- **fundsp graphs in `process()`** — combinator DSL plus a
  worker-thread rebuild pattern → [chapter 6 → fundsp](fundsp.md).
- **Off-thread work** - managed background tasks and dedicated
  worker threads for graph rebuilds, file decodes, FFTs, and
  streaming analysis → [chapter 7 → workers](workers.md).
- **MIDI** — reading and emitting MIDI events, note effects →
  [chapter 8 → midi](midi.md).
- **A richer UI** — more widgets, `section()`, switching to
  egui/iced/Slint/Vizia → [chapter 9 → gui](gui.md).
- **Shipping to users** — signed `.pkg` / `.exe` installers →
  [chapter 13 → shipping](shipping.md).
- **Real examples** — [`examples/truce-example-gain`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-gain),
  [`examples/truce-example-eq`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-eq), [`examples/truce-example-synth`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-synth),
  [`examples/truce-example-transpose`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-transpose),
  [`examples/truce-example-arpeggio`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-arpeggio),
  [`examples/truce-example-tremolo`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-tremolo),
  [`examples/truce-example-fundsp-reverb-simple`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-simple),
  [`examples/truce-example-fundsp-reverb-worker`](https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-worker) in the repo.
