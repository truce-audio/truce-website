# truce.audio — website design

## Goal

A small marketing/landing site for **truce.audio** that:

1. Pitches the **truce** Rust audio-plugin framework (`../truce/`)
2. Shows off plugins built with it — currently just **truce-analyzer** (`../truce-analyzer/`)
3. Sends developers to GitHub for source, releases, and rustdoc

Stay small. Three routes, static, no backend.

## Non-goals (v1)

- Hosting the rustdoc (lives at `truce-audio.github.io/truce`, link out)
- Hosting plugin binaries (link to GitHub Releases)
- Blog, changelog, search, i18n, analytics, accounts
- A CMS — content is authored in the repo as TS/MDX

## Hosting

**Cloudflare Pages**, Git-connected. Static export from `next build` lands in `out/` and Pages serves it. `truce.audio` is already on Cloudflare DNS, so the custom domain is just a Pages binding.

Plugin binaries continue to live on **GitHub Releases** — we don't need R2.

## Information architecture

```
/                         Home — framework pitch + plugin teaser
/plugins                  Plugin catalog (today: 1 entry)
/plugins/truce-analyzer   Plugin detail page
```

Three routes. Everything else (docs, source, releases) is an outbound link to GitHub.

## Pages

### `/` — Home

Sections, top to bottom:

1. **Nav** — `truce.audio` wordmark · `Plugins` · `GitHub` · `Docs` (→ rustdoc)
2. **Hero** — tagline ("Build audio plugins in Rust"), one-paragraph pitch, install command in a copyable code block, primary CTA (`Get started` → rustdoc reference) and secondary CTA (`View on GitHub`)
3. **Why truce** — 4–6 feature cards drawn from the framework README (7 plugin formats, hot reload, declarative params, GUI flexibility, cross-platform, automated validation)
4. **Format support matrix** — the table from the framework README, rendered cleanly
5. **Minimal example** — the gain-plugin code block from the README, syntax-highlighted
6. **Plugins** — card grid teaser → links to `/plugins`. Today this is one card (truce-analyzer).
7. **Footer** — license (MIT/Apache-2.0), GitHub org, docs, issue tracker

### `/plugins` — Catalog

Card grid of plugins built on truce. Each card:

- Cropped screenshot
- Plugin name + one-liner
- Format badges (CLAP / VST3 / LV2 / AU / AAX)
- Click → detail page

Today: one card.

### `/plugins/truce-analyzer` — Detail

- Title + tagline
- Hero screenshot (`analyzer_spectrum_macos.png`)
- **Download** buttons — one per supported platform, with the auto-detected platform as the primary (filled) button. Platforms without a release yet render as disabled "coming soon" placeholders. URLs come from `plugin.downloads[platform]`.
- Source link → GitHub repo
- Description (real-time spectrum analyzer, signal comparison, diff view)
- Second screenshot showing diff mode (`analyzer_diff_macos.png`)
- Format/platform support

## Content model

A typed module — no CMS, no DB:

```ts
// src/content/plugins.ts
export type Plugin = {
  slug: string;            // "truce-analyzer"
  name: string;            // "Truce Analyzer"
  tagline: string;
  description: string;     // short, used on catalog card
  longDescription: string; // markdown/MDX, used on detail page
  formats: Format[];       // ["clap", "vst3", "lv2", "au", "aax"]
  platforms: Platform[];   // ["macos", "windows", "linux"]
  screenshots: { src: string; alt: string }[];
  repo: string;            // GitHub URL
  releasesUrl: string;     // GitHub releases URL
};

export const plugins: Plugin[] = [ /* truce-analyzer */ ];
```

Adding a plugin = one new entry + drop screenshots in `public/`. The detail page renders generically from this shape; no per-plugin route handlers needed.

## Tech stack

- **Next.js 15**, App Router, **TypeScript**
- `output: "export"` — fully static, no server runtime needed
- **Tailwind CSS** for styling (no custom CSS framework)
- **shiki** for syntax highlighting (build-time, no runtime JS for code blocks)
- **MDX** *only* if a plugin's long description outgrows a string — start without it
- No state management, no client-side routing libs beyond what Next ships, no fetching

## Asset pipeline

Screenshots live in the source plugin repos. We don't want to fork them.

- `public/screenshots/<plugin-slug>/...png` — copied at build time by a tiny `scripts/sync-assets.ts` from `../truce-analyzer/screenshots/` (and future plugins). Wired into `prebuild`.
- One favicon, one OG image (generated via `next/og` at build time so it stays in sync with the headline).

## Visual direction

- Developer-tool aesthetic. Dark mode only — no toggle, no system-preference branching. `color-scheme: dark` is set so form controls and scrollbars match.
- One typeface (Inter via `next/font`, self-hosted — no runtime Google Fonts request).
- One accent color. Start with the purple already used in the framework README badges; revisit if it clashes.
- Code blocks are first-class: monospace, copy button, syntax highlighting.
- Restrained motion — hover states only, no scroll-triggered animation.

## File layout

```
truce-website/
  DESIGN.md
  README.md                  # how to run / deploy
  package.json
  next.config.mjs            # output: "export"
  tailwind.config.ts
  tsconfig.json
  scripts/
    sync-assets.ts           # copies screenshots from sibling repos
  src/
    app/
      layout.tsx             # root layout, theme, fonts, nav, footer
      page.tsx               # /
      plugins/
        page.tsx             # /plugins
        [slug]/page.tsx      # /plugins/:slug — generateStaticParams from plugins.ts
      opengraph-image.tsx    # build-time OG generation
    components/
      Nav.tsx
      Footer.tsx
      Hero.tsx
      FeatureGrid.tsx
      FormatMatrix.tsx
      CodeBlock.tsx          # wraps shiki output, copy button
      PluginCard.tsx
      ScreenshotFigure.tsx
    content/
      plugins.ts
      framework.ts           # tagline, install command, feature list, format matrix data
      examples.ts            # the gain code snippet, kept here so it's editable in one place
    lib/
      cn.ts                  # className helper
  public/
    favicon.ico
    screenshots/
      truce-analyzer/
        spectrum.png
        diff.png
```

## Deployment

**Cloudflare Pages**, Git-connected:

- Build command: `npm run build` (which runs `sync-assets` then `next build`)
- Output directory: `out/`
- Node version: pinned in `.nvmrc`
- Custom domain: `truce.audio`
- Preview deploys per branch — useful when adding a new plugin

If R2 is required later (e.g. mirroring plugin binaries off GitHub):

- Add a Worker route at `/downloads/*` that streams from an R2 bucket
- Or use Pages Functions with an R2 binding — same effect, lives in the same project
- Site itself stays on Pages

## Open questions

_(resolved with the user before scaffolding — kept here for context)_

- ~~Host plugin binaries on R2?~~ → No, stay on GitHub Releases.
- ~~`truce.audio` DNS?~~ → Already on Cloudflare.
- ~~Light mode in v1?~~ → Dark only, no toggle.
- ~~OG image?~~ → Per-plugin.

## Build order

1. Scaffold Next.js + Tailwind + TS, `output: "export"`, deploy a "hello" to Pages — prove the pipeline end-to-end first
2. Layout, nav, footer, theme tokens
3. Home page (hero + features + format matrix + code example)
4. `plugins.ts` content module + plugin card component
5. `/plugins` catalog
6. `/plugins/[slug]` detail page, `generateStaticParams`
7. Asset sync script + screenshots
8. OG image, favicon, metadata
9. Polish: copy buttons, hover states, responsive pass
10. Point `truce.audio` DNS at Pages
