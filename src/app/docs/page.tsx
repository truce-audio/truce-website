import type { Metadata } from "next";
import { DocsLayout } from "@/components/DocsLayout";
import { DocPage } from "@/components/DocPage";
import { getDocPage } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Docs",
  description: "Build, ship, and validate Rust audio plugins with truce.",
};

export default async function DocsIndexPage() {
  const page = await getDocPage([]);
  if (!page) {
    return (
      <DocsLayout activeHref="/docs">
        <p className="text-[var(--fg-muted)]">No docs index found.</p>
      </DocsLayout>
    );
  }
  return (
    <DocsLayout activeHref="/docs">
      <DocPage page={page} />
    </DocsLayout>
  );
}
