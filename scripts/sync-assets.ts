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
//   truce/<root>/truce-example-<short>/screenshots/<short_with_underscores>_default_macos.png
// where `<root>` is `examples` for top-level examples and
// `crates/truce-<backend>/examples` for the slint / vizia
// sub-workspace examples (each backend's crate has its own Cargo
// sub-workspace because of native-link `links =` collisions
// between vizia's skia-bindings pin and slint's). We mirror to
// public/screenshots/examples/<short>.png so the docs `examples/`
// pages reference one stable URL across local dev and the deployed
// site.
const TOP_LEVEL_EXAMPLES = [
  "gain",
  "eq",
  "synth",
  "transpose",
  "arpeggio",
  "tremolo",
  "state",
  "gain-egui",
  "gain-iced",
  "fundsp-reverb-simple",
  "fundsp-reverb-worker",
];

const SUB_WORKSPACE_EXAMPLES: Array<{ short: string; backend: string }> = [
  { short: "gain-slint", backend: "slint" },
  { short: "gain-vizia", backend: "vizia" },
];

const exampleScreenshot = (
  short: string,
  root: string,
): AssetMap["files"][number] => {
  const file = `${short.replaceAll("-", "_")}_default_macos.png`;
  return {
    from: `truce/${root}/truce-example-${short}/screenshots/${file}`,
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

// Prose synced from sibling repos. The changelog is authored in
// truce/CHANGELOG.md so releases touch it in one place; we mirror it
// into the docs tree where docs.ts picks it up as the /docs/changelog
// page. Like the screenshots, the destination is committed so the
// Cloudflare deploy — which has no sibling checkout — still ships it;
// this refresh only does anything when ../truce is present.
const DOC_FILES: Array<{ from: string; to: string }> = [
  {
    from: "truce/CHANGELOG.md",
    to: "src/content/docs/changelog.md",
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
    files: [
      ...TOP_LEVEL_EXAMPLES.map((short) => exampleScreenshot(short, "examples")),
      ...SUB_WORKSPACE_EXAMPLES.map(({ short, backend }) =>
        exampleScreenshot(short, `crates/truce-${backend}/examples`),
      ),
    ],
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

for (const { from, to } of DOC_FILES) {
  const src = resolve(workspaceRoot, from);
  const dst = resolve(repoRoot, to);

  if (!existsSync(src)) {
    console.warn(`[sync-assets] missing source: ${src}`);
    missing++;
    continue;
  }

  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  copied++;
  console.log(`[sync-assets] ${from} → ${to}`);
}

console.log(`[sync-assets] done — ${copied} copied, ${missing} missing`);
if (missing > 0) {
  console.warn("[sync-assets] some sources were missing; the build will still run but those images will 404.");
}
