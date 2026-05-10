import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsLayout } from "@/components/DocsLayout";
import { DocPage } from "@/components/DocPage";
import { docHref, getDocPage, getDocsIndex } from "@/lib/docs";

type Params = { slug: string[] };

export async function generateStaticParams(): Promise<Params[]> {
  const index = await getDocsIndex();
  return index
    .filter((m) => m.slug.length > 0)
    .map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getDocPage(slug);
  if (!page) return { title: "Not found" };
  return {
    title: page.title,
    description: page.description || undefined,
  };
}

export default async function DocSlugPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const page = await getDocPage(slug);
  if (!page) notFound();
  return (
    <DocsLayout activeHref={docHref(page.slug)}>
      <DocPage page={page} />
    </DocsLayout>
  );
}
