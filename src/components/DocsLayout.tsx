import Link from "next/link";
import { getSidebar, type SidebarSection } from "@/lib/docs";
import { TitleWithCode } from "@/components/TitleWithCode";

function SidebarSections({
  sections,
  activeHref,
}: {
  sections: SidebarSection[];
  activeHref: string;
}) {
  return (
    <>
      {sections.map((section) => (
        <div key={section.title} className="mb-4 last:mb-0">
          <h3 className="mb-1.5 font-semibold uppercase tracking-[0.18em] text-[var(--fg-subtle)] text-[0.625rem] leading-[1.4]">
            {section.title}
          </h3>
          <ul className="border-l border-[var(--border)]">
            {section.items.map((item) => {
              const isActive = item.href === activeHref;
              const className =
                "-ml-px block border-l pl-3 py-[3px] text-[0.8125rem] leading-[1.55] transition-colors " +
                (isActive
                  ? "border-[var(--pink)] text-[var(--cream)] font-medium"
                  : "border-transparent text-[var(--fg-muted)] hover:text-[var(--cream)] hover:border-[var(--border-strong)]");
              return (
                <li key={item.href}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className={className}
                    >
                      <TitleWithCode text={item.title} />
                    </a>
                  ) : (
                    <Link href={item.href} className={className}>
                      <TitleWithCode text={item.title} />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

export async function DocsLayout({
  activeHref,
  children,
}: {
  activeHref: string;
  children: React.ReactNode;
}) {
  const sections = await getSidebar();

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
      {/* Mobile docs nav lives in the header; on lg+ the sidebar is a sticky tree. */}
      <aside className="docs-sidebar-aside hidden lg:sticky lg:top-20 lg:block lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2">
        <nav aria-label="Docs navigation" className="text-sm">
          <SidebarSections sections={sections} activeHref={activeHref} />
        </nav>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
