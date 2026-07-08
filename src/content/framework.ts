export const framework = {
  name: "truce",
  domain: "truce.audio",
  tagline: "Build audio plugins in Rust.",
  description:
    "CLAP, VST3, LV2, AU v2, AU v3, AAX, and standalone — from a single Rust crate. Install and load your plugin in a DAW in five minutes.",
  github: "https://github.com/truce-audio/truce",
  rustdoc: "https://rustdoc.truce.audio/",
  license: "MIT OR Apache-2.0",
  cargoCmd: "cargo install cargo-truce",
} as const;

export type Feature = {
  title: string;
  body: string;
};

export const features: Feature[] = [
  {
    title: "7 plugin formats",
    body: "CLAP and VST3 by default; VST2, LV2, AU v2, AU v3, and AAX are opt-in per crate. One Rust codebase, every host.",
  },
  {
    title: "Cross-platform",
    body: "macOS, Windows, Linux, plus iOS via AU v3. The CLI handles signing, notarization, installers, and validation.",
  },
  {
    title: "MIDI 2.0 & multi-port",
    body: "Opt-in MIDI 2.0 / UMP and multiple MIDI in/out ports, with per-note expression (MPE) mapped across CLAP, VST3, and AU v3. MIDI 1.0 plugins are unchanged.",
  },
  {
    title: "f32 or f64 DSP",
    body: "Write 64-bit DSP with prelude64. The host's native 64-bit audio wire is taken directly on VST3, VST2, and CLAP; widen/narrow elsewhere.",
  },
  {
    title: "Pick your GUI",
    body: "Built-in widgets, egui, iced, Slint, Vizia, or raw window handle. The same plugin, your choice of toolkit.",
  },
  {
    title: "Real-time safe",
    body: "No locks or allocations in process(). The editor is a function of the params store, and state save can go fully lock-free, so opening the GUI or saving never stalls the audio thread.",
  },
  {
    title: "Declarative params",
    body: "#[derive(Params)] with ranges, units, and smoothing. Atomic storage, lock-free access from any thread.",
  },
  {
    title: "Hot reload",
    body: "Edit DSP or layout, rebuild, hear changes without restarting your DAW.",
  },
  {
    title: "Validation built in",
    body: "cargo truce validate runs auval, pluginval, and clap-validator in one command on installed plugins.",
  },
];

export type Format = "CLAP" | "VST3" | "VST2" | "LV2" | "AU v2" | "AU v3" | "AAX";
export type Platform = "macOS" | "Windows" | "Linux";

export const formats: Format[] = [
  "CLAP",
  "VST3",
  "VST2",
  "LV2",
  "AU v2",
  "AU v3",
  "AAX",
];

export const platforms: Platform[] = ["macOS", "Windows", "Linux"];

export const formatMatrix: Record<Format, Record<Platform, boolean>> = {
  CLAP: { macOS: true, Windows: true, Linux: true },
  VST3: { macOS: true, Windows: true, Linux: true },
  VST2: { macOS: true, Windows: true, Linux: true },
  LV2: { macOS: true, Windows: true, Linux: true },
  "AU v2": { macOS: true, Windows: false, Linux: false },
  "AU v3": { macOS: true, Windows: false, Linux: false },
  AAX: { macOS: true, Windows: true, Linux: false },
};

export const quickStart = `# Install the CLI (one-time)
cargo install cargo-truce

# Scaffold a new plugin
cargo truce new my-plugin
cd my-plugin

# Run the plugin standalone — no DAW needed
cargo truce run

# Build and install
cargo truce install --clap
cargo truce install --vst3

# Open your DAW, scan for plugins, load "MyPlugin"`;

export const minimalExample = `use truce::prelude::*;
use truce_gui::IntoLayoutEditor;
use truce_gui_types::layout::{knob, widgets, GridLayout};

#[derive(Params)]
pub struct GainParams {
    #[param(name = "Gain", range = "linear(-60, 6)",
            unit = "dB", smooth = "exp(5)")]
    pub gain: FloatParam,
}

use GainParamsParamId as P;

pub struct Gain;

impl PluginLogic for Gain {
    type Params = GainParams;
    type DspState = ();

    fn init(_params: &GainParams) {}

    fn reset(_state: &mut (), params: &GainParams, config: &AudioConfig) {
        params.set_sample_rate(config.sample_rate);
    }

    fn process(_state: &mut (), params: &GainParams, buffer: &mut AudioBuffer,
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

    fn editor(params: Arc<GainParams>) -> Box<dyn Editor> {
        GridLayout::build(vec![widgets(vec![knob(P::Gain, "Gain")])])
            .into_editor(&params)
    }
}

truce::plugin! { logic: Gain, params: GainParams }`;
