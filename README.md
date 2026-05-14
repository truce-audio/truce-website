# truce-website

Documentation site for [truce.audio](https://truce.audio) — the
[truce](https://github.com/truce-audio/truce) Rust audio-plugin
framework and the plugins built with it.

Next.js 15 (App Router, static export) + Tailwind + shiki.

## Local development

```sh
nvm use            # Node 20
npm install
npm run dev        # http://localhost:3536
```

`predev` and `prebuild` run `scripts/sync-assets.ts` which copies
screenshots from sibling repos (`../truce/examples/...`,
`../truce-analyzer/screenshots/...`) into `public/screenshots/`.
Source files in those repos must exist or you'll get warnings and
missing images at runtime.

## Build / typecheck

```sh
npm run build       # static export to ./out
npm run typecheck
```

## Deploy

Cloudflare Pages, Git-connected:

- Build: `npm run build`
- Output: `out/`
- Node: `20` (from `.nvmrc`)
- Custom domain: `truce.audio`

## Editing content

- **Docs pages** — markdown under `src/content/docs/`. Files are
  picked up automatically; ordering inside the sidebar is the
  explicit arrays in `src/lib/docs.ts`.
- **Plugin catalog** — add an entry to `src/content/plugins.ts`,
  drop screenshots in the source repo, then map them in
  `scripts/sync-assets.ts`. The catalog page, detail route, and
  per-plugin OG image generate from the entry.
- **Example pages** — markdown under `src/content/docs/examples/`.
  Each example's macOS default screenshot is mirrored to
  `public/screenshots/examples/<short>.png` by `sync-assets.ts`.
