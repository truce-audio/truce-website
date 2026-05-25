import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadButtons } from "@/components/DownloadButtons";
import { getPlugin, plugins } from "@/content/plugins";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return plugins.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plugin = getPlugin(slug);
  if (!plugin) return {};
  return {
    title: plugin.name,
    description: plugin.tagline,
    openGraph: {
      title: plugin.name,
      description: plugin.tagline,
      images: [{ url: plugin.heroScreenshot.src }],
    },
  };
}

export default async function PluginPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const plugin = getPlugin(slug);
  if (!plugin) notFound();

  return (
    <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/plugins"
        className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        ← All plugins
      </Link>

      <header className="mt-6 mb-10">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {plugin.name}
        </h1>
        <p className="mt-3 text-lg text-[var(--fg-muted)] leading-relaxed">
          {plugin.tagline}
        </p>
        <div className="mt-6 space-y-3">
          {!plugin.downloads && plugin.buildCommand ? (
            <BuildFromSource command={plugin.buildCommand} />
          ) : (
            <DownloadButtons
              platforms={plugin.platforms}
              downloads={plugin.downloads}
            />
          )}
          <div>
            <a
              href={plugin.repo}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] underline underline-offset-4"
            >
              Source on GitHub →
            </a>
          </div>
        </div>
      </header>

      <section className="prose-truce mt-10 max-w-none after:block after:clear-both after:content-['']">
        <figure className="mb-6 sm:float-left sm:mr-8 sm:mb-4 sm:max-w-[55%]">
          <div
            className="mx-auto overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-code)]"
            style={{ maxWidth: `${plugin.heroScreenshot.width ?? 1600}px` }}
          >
            <Image
              src={plugin.heroScreenshot.src}
              alt={plugin.heroScreenshot.alt}
              width={plugin.heroScreenshot.width ?? 1600}
              height={plugin.heroScreenshot.height ?? 900}
              className="h-auto w-full"
            />
          </div>
        </figure>
        {plugin.longDescription.map((p, i) => (
          <p
            key={i}
            className="my-6 leading-relaxed text-[var(--fg)] first:mt-0"
          >
            {p}
          </p>
        ))}
      </section>

      {plugin.screenshots.map((s, i) => (
        <ScreenshotFigure
          key={i}
          src={s.src}
          alt={s.alt}
          caption={s.caption}
          width={s.width}
          height={s.height}
        />
      ))}

      <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Formats">
          <div className="flex flex-wrap gap-1.5">
            {plugin.formats.map((f) => (
              <span
                key={f}
                className="rounded border border-[var(--border)] px-2 py-0.5 text-xs"
              >
                {f}
              </span>
            ))}
          </div>
        </Field>
        <Field label="Platforms">
          <div className="flex flex-wrap gap-1.5">
            {plugin.platforms.map((p) => (
              <span
                key={p}
                className="rounded border border-[var(--border)] px-2 py-0.5 text-xs"
              >
                {p}
              </span>
            ))}
          </div>
        </Field>
      </section>
    </article>
  );
}

function ScreenshotFigure({
  src,
  alt,
  caption,
  width,
  height,
}: {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}) {
  // `max-w-full` (vs `w-full`) lets small editor screenshots
  // render at their natural size instead of upscaling to the
  // article column width. The figure stays centered via
  // `mx-auto` and the surrounding box hugs the image rather
  // than the column.
  const w = width ?? 1600;
  const h = height ?? 900;
  return (
    <figure className="mt-8">
      <div
        className="mx-auto overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-code)]"
        style={{ maxWidth: `${w}px` }}
      >
        <Image
          src={src}
          alt={alt}
          width={w}
          height={h}
          className="h-auto w-full"
        />
      </div>
      {caption && (
        <figcaption className="mx-auto mt-3 text-sm text-[var(--fg-muted)]" style={{ maxWidth: `${w}px` }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function BuildFromSource({ command }: { command: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--fg-muted)]">
        Build-from-source example — no installer. Clone the repo
        and run:
      </p>
      <pre className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--bg-code)] px-4 py-3 text-sm">
        <code>{command}</code>
      </pre>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--fg-muted)] mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}
