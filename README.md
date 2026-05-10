# truce-website

Marketing site for [truce.audio](https://truce.audio) — the [truce](https://github.com/truce-audio/truce) Rust audio-plugin framework and the plugins built with it.

See [DESIGN.md](DESIGN.md) for the full design.

## Stack

- Next.js 15 (App Router) with `output: "export"`
- TypeScript, Tailwind CSS
- shiki for build-time syntax highlighting
- `next/og` for the per-plugin Open Graph images

## Local development

```sh
nvm use            # Node 20+
npm install
npm run dev        # http://localhost:3000
```

`predev` and `prebuild` run `scripts/sync-assets.ts`, which copies plugin screenshots from sibling repos (`../truce-analyzer/screenshots/...`) into `public/screenshots/<slug>/`. Source files in those repos must exist or you'll get warnings (and missing images at runtime).

## Build

```sh
npm run build      # static export to ./out
```

Type-check separately with `npm run typecheck`.

## Deploy (Cloudflare Pages)

The site is fully static — drop `out/` on any static host. We use **Cloudflare Pages**:

- Connect the repo to Pages
- Build command: `npm run build`
- Build output directory: `out`
- Node version: `20` (read from `.nvmrc`)
- Custom domain: `truce.audio` (already on Cloudflare DNS)

## Adding a plugin

1. Add an entry to `src/content/plugins.ts` (`Plugin` type — slug, name, tagline, formats, screenshots, repo, releases URL)
2. Add the source screenshots to the plugin's repo
3. Map them in `scripts/sync-assets.ts` so the build copies them into `public/screenshots/<slug>/`
4. `npm run build` — the catalog page, the detail route, and the per-plugin OG image are generated automatically from the entry

No new files or routes needed.
