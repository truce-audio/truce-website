import type { DocPage as DocPageType } from "@/lib/docs";

export function DocPage({ page }: { page: DocPageType }) {
  return (
    <article className="min-w-0">
      <header className="mb-10">
        {page.eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cyan)]">
            {page.eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--cream)]">
          {page.title}
        </h1>
      </header>

      <div className="prose-doc" dangerouslySetInnerHTML={{ __html: page.html }} />
    </article>
  );
}
