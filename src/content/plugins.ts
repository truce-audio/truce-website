import type { Format, Platform } from "./framework";

export type Screenshot = {
  src: string;
  alt: string;
  caption?: string;
  /**
   * Natural pixel dimensions. Used so the figure on the detail
   * page caps at the image's own size instead of upscaling a
   * small editor screenshot to fill the article column. Falls
   * back to a 16:9 default when omitted.
   */
  width?: number;
  height?: number;
};

export type Plugin = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  longDescription: string[];
  formats: Format[];
  platforms: Platform[];
  heroScreenshot: Screenshot;
  screenshots: Screenshot[];
  /** Per-platform download URL. Missing entry = button shown but disabled ("Coming soon"). */
  downloads?: Partial<Record<Platform, string>>;
  /**
   * One-liner shown in place of download buttons when the plugin
   * isn't (and isn't expected to be) shipped as a binary release —
   * e.g. example plugins built from source. Ignored when
   * `downloads` is set.
   */
  buildCommand?: string;
  repo: string;
  releasesUrl: string;
};

export const plugins: Plugin[] = [
  {
    slug: "truce-analyzer",
    name: "Truce Analyzer",
    tagline: "A real-time spectrum analyzer with diff overlay for debugging audio plugins.",
    description:
      "Compare signals across your chain without extra tracks or sends. Insert one before processing, one after, and see exactly what your plugins do.",
    longDescription: [
      "Truce Analyzer is a real-time frequency-spectrum analyzer aimed at debugging and reverse-engineering audio plugins. It runs in any DAW that supports CLAP, VST3, LV2, AU, or AAX.",
      "Insert one instance before your processing and one after, then select the “before” instance as a source in the “after” instance. The plugin overlays the two spectra so you can see exactly how your chain is shaping the signal.",
      "Diff mode highlights what changed: red where your processing added energy, green where it removed it, gray for the unmodified source. You can also select multiple sources to compare against several points in your chain at once.",
    ],
    formats: ["CLAP", "VST3", "LV2", "AU v2", "AAX"],
    platforms: ["macOS", "Windows", "Linux"],
    heroScreenshot: {
      src: "/screenshots/truce-analyzer/diff.png",
      alt: "Truce Analyzer diff view — before/after EQ comparison with spectral diff overlay",
      width: 1600,
      height: 800,
    },
    screenshots: [],
    downloads: {
      macOS:
        "https://github.com/truce-audio/truce-analyzer/releases/download/v0.40.1/truce-analyzer-0.40.1-macos.pkg",
      Windows:
        "https://github.com/truce-audio/truce-analyzer/releases/download/v0.40.1/truce-analyzer-0.40.1-windows.exe",
      Linux:
        "https://github.com/truce-audio/truce-analyzer/releases/download/v0.40.1/truce-analyzer-0.40.1-linux-x86_64.tar.gz",
    },
    repo: "https://github.com/truce-audio/truce-analyzer",
    releasesUrl: "https://github.com/truce-audio/truce-analyzer/releases/latest",
  },
  {
    slug: "truce-example-eq",
    name: "Truce EQ",
    tagline: "3-band parametric equalizer using biquad filters.",
    description:
      "3-band parametric EQ — low / mid / high, each with frequency, gain, and Q. Built-in GUI with section-based layout, f64 DSP path for precision-sensitive filter coefficients.",
    longDescription: [
      "Truce EQ is one of the in-tree example plugins shipped with the truce framework. It's a 3-band parametric equalizer using biquad filters in Direct Form II Transposed, with logarithmic frequency / Q parameter ranges and per-sample coefficient updates driven from the smoothed parameters.",
      "The DSP runs end-to-end at f64 (`use truce::prelude64::*`). Biquad coefficient computation is precision-sensitive at low Q × low frequency, and the format wrapper widens host f32 to plugin f64 at the block boundary so the math stays in f64 throughout.",
      "Auto-bypass kicks in when a band's gain is within ε of 0 dB, so unused bands cost nothing at runtime.",
    ],
    formats: ["CLAP", "VST3", "LV2", "AU v2", "AU v3"],
    platforms: ["macOS", "Windows", "Linux"],
    heroScreenshot: {
      src: "/screenshots/examples/eq.png",
      alt: "Truce EQ showing three bands (LOW / MID / HIGH) with frequency, gain, and Q knobs",
      width: 416,
      height: 724,
    },
    screenshots: [],
    downloads: {
      macOS:
        "https://github.com/truce-audio/truce/releases/download/v0.40.1/truce-example-eq-0.40.1-macos.pkg",
      Windows:
        "https://github.com/truce-audio/truce/releases/download/v0.40.1/truce-example-eq-0.40.1-windows.exe",
      Linux:
        "https://github.com/truce-audio/truce/releases/download/v0.40.1/truce-example-eq-0.40.1-linux-x86_64.tar.gz",
    },
    repo: "https://github.com/truce-audio/truce/tree/main/examples/truce-example-eq",
    releasesUrl: "https://github.com/truce-audio/truce/releases/latest",
  },
  {
    slug: "truce-example-fundsp-reverb-worker",
    name: "Truce Fundsp Reverb (worker)",
    tagline:
      "Stereo plate reverb built on the fundsp graph DSL — production-shaped integration pattern. Not for production use.",
    description:
      "Stereo plate reverb wired through a fundsp audio graph. The worker variant rebuilds the graph on a dedicated background thread and swaps it in via lock-free queues so `process()` stays allocation-free.",
    longDescription: [
      "This is a teaching example for integrating the fundsp graph DSL inside a truce plugin. The signal flow is straightforward — high-pass → low-pass → reverb_stereo bussed against a dry path — but the interesting part is the thread structure around the graph rebuild.",
      "The worker variant rebuilds the fundsp graph on a dedicated background thread and hands the finished graph to the audio thread through three lock-free queues (`requests`, `ready`, `discard`). `process()` never calls `Box::new`, never calls `graph.allocate()`, and never drops a graph. This is the shape you want for shipping fundsp-backed DSP.",
      "Not intended for production use. fundsp's `reverb_stereo` bakes RT60 into the FDN's feedback gains at construction, so every Time change forces a full graph rebuild — and a fresh graph means the reverb's delay lines reset, dropping the tail. Moving the Time knob mid-playback audibly cuts the reverb. The example exists to demonstrate the integration shape (Shared atomics, `var()` reads, the worker-thread + atomic-swap pattern), not to be a usable plate reverb.",
      "For the simpler variant that rebuilds inline on the audio thread (rt-unsafe but easier to read top-to-bottom), see Truce Fundsp Reverb (simple).",
      "See the fundsp integration guide on this site for a walk-through of both variants, the rebuild trigger, and why the threshold + raw-target read are wired the way they are.",
    ],
    formats: ["CLAP", "VST3", "LV2", "AU v2", "AU v3"],
    platforms: ["macOS", "Windows", "Linux"],
    heroScreenshot: {
      src: "/screenshots/examples/fundsp-reverb-worker.png",
      alt: "Truce Fundsp Reverb (worker variant) showing Low Cut, High Cut, Time, Mix knobs and a stereo level meter",
      width: 416,
      height: 364,
    },
    screenshots: [],
    downloads: {
      macOS:
        "https://github.com/truce-audio/truce/releases/download/v0.40.1/truce-example-fundsp-reverb-worker-0.40.1-macos.pkg",
      Windows:
        "https://github.com/truce-audio/truce/releases/download/v0.40.1/truce-example-fundsp-reverb-worker-0.40.1-windows.exe",
      Linux:
        "https://github.com/truce-audio/truce/releases/download/v0.40.1/truce-example-fundsp-reverb-worker-0.40.1-linux-x86_64.tar.gz",
    },
    repo: "https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-worker",
    releasesUrl: "https://github.com/truce-audio/truce/releases/latest",
  },
  {
    slug: "truce-example-fundsp-reverb-simple",
    name: "Truce Fundsp Reverb (simple)",
    tagline:
      "Stereo plate reverb built on the fundsp graph DSL — pedagogical inline rebuild. Not for production use.",
    description:
      "Stereo plate reverb wired through a fundsp audio graph. The simple variant rebuilds the graph inline on the audio thread — easier to read end-to-end, but rt-unsafe.",
    longDescription: [
      "This is a teaching example for integrating the fundsp graph DSL inside a truce plugin. The signal flow is straightforward — high-pass → low-pass → reverb_stereo bussed against a dry path.",
      "The simple variant calls `rebuild_graph` directly from inside `process()` when the Time knob crosses the rebuild threshold. `Box::new(...)` and `graph.allocate()` run on the audio thread. That's a real-time-safety violation — those calls can block on the system allocator — and exists in this crate only so the integration shape is visible end-to-end in one file. The worker variant moves both off-thread; everything else about the graph wiring is identical.",
      "Not intended for production use. Two reasons. First, the inline rebuild itself is rt-unsafe (see above). Second — and this affects both variants — fundsp's `reverb_stereo` bakes RT60 into the FDN's feedback gains at construction, so every Time change forces a full graph rebuild and a fresh graph means the reverb's delay lines reset, dropping the tail. Moving the Time knob mid-playback audibly cuts the reverb.",
      "For the worker-thread variant that keeps `process()` allocation-free, see Truce Fundsp Reverb (worker).",
      "See the fundsp integration guide on this site for a walk-through of both variants, the rebuild trigger, and why the threshold + raw-target read are wired the way they are.",
    ],
    formats: ["CLAP", "VST3", "LV2", "AU v2", "AU v3"],
    platforms: ["macOS", "Windows", "Linux"],
    heroScreenshot: {
      src: "/screenshots/examples/fundsp-reverb-simple.png",
      alt: "Truce Fundsp Reverb (simple variant) showing Low Cut, High Cut, Time, Mix knobs and a stereo level meter",
      width: 416,
      height: 364,
    },
    screenshots: [],
    downloads: {
      macOS:
        "https://github.com/truce-audio/truce/releases/download/v0.40.1/truce-example-fundsp-reverb-simple-0.40.1-macos.pkg",
      Windows:
        "https://github.com/truce-audio/truce/releases/download/v0.40.1/truce-example-fundsp-reverb-simple-0.40.1-windows.exe",
      Linux:
        "https://github.com/truce-audio/truce/releases/download/v0.40.1/truce-example-fundsp-reverb-simple-0.40.1-linux-x86_64.tar.gz",
    },
    repo: "https://github.com/truce-audio/truce/tree/main/examples/truce-example-fundsp-reverb-simple",
    releasesUrl: "https://github.com/truce-audio/truce/releases/latest",
  },
];

export function getPlugin(slug: string): Plugin | undefined {
  return plugins.find((p) => p.slug === slug);
}
