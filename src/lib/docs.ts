import { promises as fs } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DOCS_ROOT = resolve(__dirname, "../content/docs");

export type DocSlug = string[];

export type DocMeta = {
  /** Slug parts as they appear in /docs/<...slug>. README.md → directory slug. */
  slug: DocSlug;
  /** Posix-style path relative to DOCS_ROOT (e.g. "reference/install.md"). */
  sourcePath: string;
  /** First H1 in the file, with any leading "N. " chapter number stripped. */
  title: string;
  /** Optional eyebrow such as "Chapter 1" derived from "1. Title" headings. */
  eyebrow?: string;
  /** Plain-text excerpt for cards / metadata. */
  description: string;
};

export type DocPage = DocMeta & {
  /** Rendered HTML body (without the H1). */
  html: string;
};

/**
 * Walk the docs tree and return one DocMeta per markdown file.
 * The result is cached on the module — reads once per build process.
 */
let cachedIndex: Promise<DocMeta[]> | null = null;
export function getDocsIndex(): Promise<DocMeta[]> {
  if (!cachedIndex) cachedIndex = buildIndex();
  return cachedIndex;
}

async function buildIndex(): Promise<DocMeta[]> {
  const files = await collectMarkdownFiles(DOCS_ROOT);
  const metas = await Promise.all(files.map(readMeta));
  // Stable sort by slug for deterministic output.
  metas.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  return metas;
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectMarkdownFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function sourceToSlug(sourcePath: string): DocSlug {
  // "reference/install.md" -> ["reference", "install"]
  // "reference/README.md"  -> ["reference"]
  // "README.md"            -> [] (the docs index)
  const noExt = sourcePath.replace(/\.md$/, "");
  const parts = noExt.split("/");
  const last = parts[parts.length - 1];
  if (last === "README") return parts.slice(0, -1);
  return parts;
}

async function readMeta(absPath: string): Promise<DocMeta> {
  const sourcePath = relative(DOCS_ROOT, absPath).split("\\").join("/");
  const raw = await fs.readFile(absPath, "utf8");
  const { content } = matter(raw);

  const { title, eyebrow } = extractTitle(content) ?? {
    title: humanizePath(sourcePath),
    eyebrow: undefined,
  };

  const description = firstParagraph(content);

  return {
    slug: sourceToSlug(sourcePath),
    sourcePath,
    title,
    eyebrow,
    description,
  };
}

function extractTitle(content: string): { title: string; eyebrow?: string } | null {
  const m = content.match(/^#\s+(.+?)\s*$/m);
  if (!m) return null;
  const raw = m[1].trim();
  // "1. Install" -> { eyebrow: "Chapter 1", title: "Install" }
  const numbered = raw.match(/^(\d+)\.\s+(.+)$/);
  if (numbered) {
    return { eyebrow: `Chapter ${numbered[1]}`, title: numbered[2] };
  }
  return { title: raw };
}

function firstParagraph(content: string): string {
  // Strip front matter is already done. Strip first H1, then take first non-empty paragraph.
  const stripped = content.replace(/^#\s+.+$/m, "").trim();
  const paragraphs = stripped.split(/\n{2,}/);
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith(">")) continue;
    if (trimmed.startsWith("|")) continue;
    if (trimmed.startsWith("```")) continue;
    return trimmed.replace(/\s+/g, " ").slice(0, 280);
  }
  return "";
}

function humanizePath(sourcePath: string): string {
  const base = sourcePath.replace(/\.md$/, "").split("/").pop() ?? sourcePath;
  return base.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build the rendered page for a given slug (e.g. ["reference", "install"]). */
export async function getDocPage(slug: DocSlug): Promise<DocPage | null> {
  const index = await getDocsIndex();
  const meta = index.find((m) => slugEquals(m.slug, slug));
  if (!meta) return null;

  const absPath = join(DOCS_ROOT, meta.sourcePath);
  const raw = await fs.readFile(absPath, "utf8");
  const { content } = matter(raw);

  // Strip the first H1 — we render the title separately in the layout
  // so we can pair it with an eyebrow.
  const body = content.replace(/^#\s+.+\n+/, "");

  const html = await renderMarkdown(body, meta.sourcePath);
  return { ...meta, html };
}

function slugEquals(a: DocSlug, b: DocSlug): boolean {
  if (a.length !== b.length) return false;
  return a.every((part, i) => part === b[i]);
}

/**
 * Rewrite relative .md links so they resolve to /docs/... routes.
 * `parents.md`           -> `/docs/<dir>/parents`
 * `../formats/clap.md`   -> `/docs/formats/clap`
 * `gui/README.md`        -> `/docs/<dir>/gui`
 * `parameters.md#meters` -> `/docs/<dir>/parameters#meters`
 * Absolute URLs and pure anchors are left alone.
 */
function rewriteDocLink(href: string, sourcePath: string): string {
  if (!href) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href; // absolute scheme
  if (href.startsWith("/")) return href;
  if (href.startsWith("#")) return href;

  const [pathPart, hash = ""] = href.split("#", 2);
  const hashSuffix = hash ? `#${hash}` : "";

  // Resolve relative to the source file's directory using posix semantics.
  const sourceDir = posix.dirname(sourcePath);
  const resolved = posix.normalize(posix.join(sourceDir, pathPart));

  // A resolved path that escapes the docs root means too many `..` segments
  // in source. Fail loud at build time so it doesn't ship as `/docs/../foo`.
  if (resolved.startsWith("..")) {
    throw new Error(
      `[docs] link "${href}" in ${sourcePath} resolves above the docs root (${resolved}). Did you mean one fewer "../"?`,
    );
  }

  // Drop trailing slash on directory links: "../formats/" -> "formats"
  let normalized = resolved.replace(/\/+$/, "");
  // README.md collapses to its directory: "reference/README.md" -> "reference"
  normalized = normalized.replace(/(^|\/)README\.md$/, "$1").replace(/\/$/, "");
  // Drop the .md extension on file links.
  normalized = normalized.replace(/\.md$/, "");

  if (!normalized) return `/docs${hashSuffix}`;
  return `/docs/${normalized}${hashSuffix}`;
}

async function renderMarkdown(markdown: string, sourcePath: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    // Markdown lives in-repo alongside the site code, so raw HTML
    // (e.g. the `<img width="300">` tags in examples/README.md) is
    // trusted. Without this pair, the `<img>` cells in the
    // screenshots table render as empty space because remark-rehype
    // drops them and rehype-stringify would otherwise escape them.
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: "prepend",
      properties: { className: ["heading-anchor"], "aria-label": "Permalink" },
      content: { type: "text", value: "#" },
    })
    .use(rehypeRewriteLinks, { sourcePath })
    .use(rehypeShiki, { theme: "github-dark" })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);
  return String(file);
}

type RewriteLinksOptions = { sourcePath: string };

function rehypeRewriteLinks(options: RewriteLinksOptions) {
  return (tree: unknown) => {
    visit(tree as never, "element", (node: { tagName?: string; properties?: Record<string, unknown> }) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string") return;
      node.properties!.href = rewriteDocLink(href, options.sourcePath);
    });
  };
}

/** Sidebar tree built from a curated order, falling back to the index for stragglers. */
export type SidebarSection = {
  title: string;
  items: Array<{ title: string; href: string; eyebrow?: string }>;
};

export async function getSidebar(): Promise<SidebarSection[]> {
  const index = await getDocsIndex();
  const find = (path: string) => index.find((m) => m.sourcePath === path);

  const linkOf = (m: DocMeta) => ({
    title: m.title,
    href: docHref(m.slug),
    eyebrow: m.eyebrow,
  });

  const ref = (path: string) => {
    const m = find(path);
    return m ? linkOf(m) : null;
  };

  const guideOrder = [
    "guide/install.md",
    "guide/first-plugin.md",
    "guide/plugin-anatomy.md",
    "guide/parameters.md",
    "guide/processing.md",
    "guide/fundsp.md",
    "guide/midi.md",
    "guide/gui.md",
    "guide/audio-testing.md",
    "guide/shipping.md",
    "guide/ios.md",
    "guide/hot-reload.md",
  ];

  const guiOrder = [
    "guide/gui/built-in.md",
    "guide/gui/egui.md",
    "guide/gui/iced.md",
    "guide/gui/slint.md",
    "guide/gui/vizia.md",
    "guide/gui/raw-window-handle.md",
    "guide/gui/screenshot-testing.md",
  ];

  const referenceOrder = [
    "reference/cli.md",
    "reference/params.md",
    "reference/truce-toml.md",
    "reference/cargo-config.md",
  ];

  const examplesOrder = [
    "examples/README.md",
    "examples/gain.md",
    "examples/eq.md",
    "examples/synth.md",
    "examples/transpose.md",
    "examples/arpeggio.md",
    "examples/tremolo.md",
    "examples/state.md",
    "examples/fundsp-reverb-simple.md",
    "examples/fundsp-reverb-worker.md",
    "examples/gain-egui.md",
    "examples/gain-iced.md",
    "examples/gain-slint.md",
    "examples/gain-vizia.md",
    "examples/gui-zoo.md",
    "examples/gui-zoo-egui.md",
    "examples/gui-zoo-iced.md",
    "examples/gui-zoo-slint.md",
    "examples/gui-zoo-vizia.md",
    "examples/block-gain.md",
    "examples/block-drywet.md",
    "examples/block-gate.md",
    "examples/block-saturate.md",
    "examples/block-widen.md",
    "examples/block-surround-meter.md",
    "examples/reiss-delay.md",
    "examples/reiss-vibrato.md",
    "examples/reiss-flanger.md",
    "examples/reiss-chorus.md",
    "examples/reiss-pingpong.md",
    "examples/reiss-parametric-eq.md",
    "examples/reiss-wahwah.md",
    "examples/reiss-phaser.md",
    "examples/reiss-tremolo.md",
    "examples/reiss-ringmod.md",
    "examples/reiss-compressor.md",
    "examples/reiss-distortion.md",
    "examples/reiss-panning.md",
    "examples/reiss-robotization.md",
    "examples/reiss-pitchshift.md",
  ];

  const formatOrder = [
    // Standalone first — it's the no-DAW path most newcomers hit
    // before they have a host configured, so it leads the section.
    "formats/standalone.md",
    "formats/clap.md",
    "formats/vst3.md",
    "formats/lv2.md",
    "formats/au.md",
    "formats/au-ios.md",
    "formats/aax.md",
    // VST2 last — legacy / niche.
    "formats/vst2.md",
  ];

  const collect = (paths: string[]) =>
    paths.map(ref).filter((x): x is NonNullable<typeof x> => Boolean(x));

  return [
    {
      title: "Overview",
      items: [
        { title: "Quick start", href: "/docs", eyebrow: undefined },
        ...collect(["changelog.md", "roadmap.md"]),
      ],
    },
    { title: "Guide", items: collect(guideOrder) },
    { title: "Reference", items: collect(referenceOrder) },
    { title: "GUI backends", items: collect(guiOrder) },
    { title: "Formats", items: collect(formatOrder) },
    { title: "Examples", items: collect(examplesOrder) },
  ].filter((s) => s.items.length > 0);
}

export function docHref(slug: DocSlug): string {
  if (slug.length === 0) return "/docs";
  return `/docs/${slug.join("/")}`;
}
