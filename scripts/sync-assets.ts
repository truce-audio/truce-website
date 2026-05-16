#!/usr/bin/env tsx
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const workspaceRoot = resolve(repoRoot, "..");

type AssetMap = {
  plugin: string;
  files: Array<{ from: string; to: string; resizeWidth?: number }>;
};

// Each example's macOS default screenshot lives at
//   truce/examples/truce-example-<short>/screenshots/<short_with_underscores>_default_macos.png
// We mirror it to public/screenshots/examples/<short>.png so the
// docs `examples/` pages reference one stable URL across local
// dev and the deployed site.
const EXAMPLE_SHORT_NAMES = [
  "gain",
  "eq",
  "synth",
  "transpose",
  "arpeggio",
  "tremolo",
  "state",
  "gain-egui",
  "gain-iced",
  "gain-slint",
  "fundsp-reverb-simple",
  "fundsp-reverb-worker",
];

const exampleScreenshot = (short: string): AssetMap["files"][number] => {
  const file = `${short.replaceAll("-", "_")}_default_macos.png`;
  return {
    from: `truce/examples/truce-example-${short}/screenshots/${file}`,
    to: `public/screenshots/examples/${short}.png`,
  };
};

// iOS container baselines are full simulator framebuffers
// (1206x2436 portrait, 2622x1206 landscape) — way larger than the
// docs prose column. Resize on copy so the rendered page doesn't
// ship multi-megapixel PNGs for a 280-px wide display slot.
const IOS_SCREENSHOTS: AssetMap["files"] = [
  {
    from: "truce/examples/truce-example-gain/screenshots/gain_container_ios.png",
    to: "public/screenshots/ios/gain_container.png",
    resizeWidth: 360,
  },
  {
    from: "truce/examples/truce-example-state/screenshots/state_container_ios.png",
    to: "public/screenshots/ios/state_container.png",
    resizeWidth: 720,
  },
];

const assetMaps: AssetMap[] = [
  {
    plugin: "truce-analyzer",
    files: [
      {
        from: "truce-analyzer/screenshots/analyzer_spectrum_macos.png",
        to: "public/screenshots/truce-analyzer/spectrum.png",
      },
      {
        from: "truce-analyzer/screenshots/analyzer_diff_macos.png",
        to: "public/screenshots/truce-analyzer/diff.png",
      },
    ],
  },
  {
    plugin: "truce-examples",
    files: EXAMPLE_SHORT_NAMES.map(exampleScreenshot),
  },
  {
    plugin: "truce-ios",
    files: IOS_SCREENSHOTS,
  },
];

let copied = 0;
let missing = 0;

for (const asset of assetMaps) {
  for (const { from, to, resizeWidth } of asset.files) {
    const src = resolve(workspaceRoot, from);
    const dst = resolve(repoRoot, to);

    if (!existsSync(src)) {
      console.warn(`[sync-assets] missing source: ${src}`);
      missing++;
      continue;
    }

    mkdirSync(dirname(dst), { recursive: true });
    if (resizeWidth) {
      // Copy first, then resize in place. `sips` is macOS-only;
      // fall back to a plain copy on other platforms so the build
      // doesn't fail — the page will just render a larger image.
      copyFileSync(src, dst);
      try {
        execFileSync("sips", ["--resampleWidth", String(resizeWidth), dst], {
          stdio: "ignore",
        });
      } catch {
        console.warn(
          `[sync-assets] sips unavailable; ${to} kept at source resolution.`,
        );
      }
    } else {
      copyFileSync(src, dst);
    }
    copied++;
    console.log(`[sync-assets] ${from} → ${to}${resizeWidth ? ` (resized to ${resizeWidth}px)` : ""}`);
  }
}

console.log(`[sync-assets] done — ${copied} copied, ${missing} missing`);
if (missing > 0) {
  console.warn("[sync-assets] some sources were missing; the build will still run but those images will 404.");
}
