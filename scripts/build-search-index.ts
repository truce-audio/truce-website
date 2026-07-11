#!/usr/bin/env tsx
import { promises as fs } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

// Build the client-side search corpus. Walks the docs markdown tree and
// emits one record per page (title, section, headings, trimmed prose) to
// public/search-index.json, which the <SearchModal> fetches once and
// feeds to MiniSearch in the browser. Runs in prebuild/predev after
// sync-assets, so the synced changelog page is indexed too.
//
// Self-contained (like sync-assets.ts) rather than importing src/lib/docs
// so it stays a plain node/tsx script with no app-module or bundler-alias
// dependency. The slug -> href derivation mirrors `sourceToSlug` /
// `docHref` there; keep them in step if the routing changes.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const DOCS_ROOT = resolve(repoRoot, "src/content/docs");
const OUT_FILE = resolve(repoRoot, "public/search-index.json");

// Prose beyond this many characters per page is dropped from the index.
// Keeps one long page (the changelog) from dominating the payload; the
// lead content plus every heading still index in full.
const MAX_TEXT_CHARS = 4000;

type SearchDoc = {
  id: number;
  title: string;
  section: string;
  href: string;
  headings: string;
  excerpt: string;
  text: string;
};

async function collectMarkdown(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectMarkdown(full)));
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/** "reference/install.md" -> ["reference","install"]; README collapses to its dir. */
function sourceToSlug(sourcePath: string): string[] {
  const parts = sourcePath.replace(/\.md$/, "").split("/");
  if (parts[parts.length - 1] === "README") return parts.slice(0, -1);
  return parts;
}

function docHref(slug: string[]): string {
  return slug.length === 0 ? "/docs" : `/docs/${slug.join("/")}`;
}

/** Sidebar-style section label, keyed off the slug's leading segments. */
function sectionLabel(slug: string[]): string {
  const [a, b] = slug;
  if (a === "guide") return b === "gui" ? "GUI backends" : "Guide";
  if (a === "reference") return "Reference";
  if (a === "formats") return "Formats";
  if (a === "examples") return "Examples";
  return "Overview";
}

/** First H1, with any "N. " chapter prefix stripped; falls back to the filename. */
function extractTitle(content: string, sourcePath: string): string {
  const m = content.match(/^#\s+(.+?)\s*$/m);
  if (!m) {
    const base = sourcePath.replace(/\.md$/, "").split("/").pop() ?? sourcePath;
    return base.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return cleanInline(m[1].replace(/^\d+\.\s+/, ""));
}

/** Strip inline markdown (code spans, links, emphasis) from a short run. */
function cleanInline(s: string): string {
  return s
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();
}

/** Reduce a markdown body to searchable plain text. */
function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/<[^>]+>/g, " ") // raw html tags
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/^#{1,6}\s+/gm, "") // heading hashes
    .replace(/^\s{0,3}>\s?/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "") // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, "") // ordered list markers
    .replace(/\|/g, " ") // table pipes
    .replace(/^[-=]{3,}\s*$/gm, " ") // hr / setext underlines
    .replace(/[*_~]/g, "") // emphasis marks
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const files = (await collectMarkdown(DOCS_ROOT)).sort();
  const docs: SearchDoc[] = [];

  for (const abs of files) {
    const sourcePath = relative(DOCS_ROOT, abs).split("\\").join("/");
    const raw = await fs.readFile(abs, "utf8");
    const { content } = matter(raw);

    const slug = sourceToSlug(sourcePath);
    const title = extractTitle(content, sourcePath);

    // Drop the first H1 so it doesn't repeat inside text/excerpt.
    const body = content.replace(/^#\s+.+\n+/, "");

    const headings = [...body.matchAll(/^#{2,3}\s+(.+)$/gm)]
      .map((m) => cleanInline(m[1]))
      .join(" · ");

    const plain = toPlainText(body);

    docs.push({
      id: docs.length,
      title,
      section: sectionLabel(slug),
      href: docHref(slug),
      headings,
      excerpt: plain.slice(0, 200),
      text: plain.slice(0, MAX_TEXT_CHARS),
    });
  }

  await fs.mkdir(dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(docs), "utf8");
  const bytes = Buffer.byteLength(JSON.stringify(docs));
  console.log(
    `[build-search-index] ${docs.length} pages -> ${relative(repoRoot, OUT_FILE)} (${(bytes / 1024).toFixed(0)} KB)`,
  );
}

main().catch((err) => {
  console.error("[build-search-index] failed:", err);
  process.exit(1);
});
