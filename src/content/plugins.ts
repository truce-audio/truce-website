import type { Format, Platform } from "./framework";

export type Screenshot = {
  src: string;
  alt: string;
  caption?: string;
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
      src: "/screenshots/truce-analyzer/spectrum.png",
      alt: "Truce Analyzer showing a real-time spectrum on macOS",
    },
    screenshots: [
      {
        src: "/screenshots/truce-analyzer/diff.png",
        alt: "Before/after EQ comparison showing spectral diff",
        caption:
          "Diff view — red is energy added, green is energy removed, gray is the source signal.",
      },
    ],
    downloads: {
      macOS: "https://github.com/truce-audio/truce-analyzer/releases/latest",
      // Windows + Linux installers not yet shipped — buttons render as disabled placeholders.
    },
    repo: "https://github.com/truce-audio/truce-analyzer",
    releasesUrl: "https://github.com/truce-audio/truce-analyzer/releases/latest",
  },
];

export function getPlugin(slug: string): Plugin | undefined {
  return plugins.find((p) => p.slug === slug);
}
