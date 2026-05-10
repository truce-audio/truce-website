import Link from "next/link";
import { getSidebar } from "@/lib/docs";

export async function DocsLayout({
  activeHref,
  children,
}: {
  activeHref: string;
  children: React.ReactNode;
}) {
  const sections = await getSidebar();

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2">
        <nav aria-label="Docs navigation" className="space-y-7 text-sm">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
                {section.title}
              </h3>
              <ul className="space-y-0.5 border-l border-[var(--border)]">
                {section.items.map((item) => {
                  const isActive = item.href === activeHref;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={
                          "-ml-px block border-l py-1.5 pl-3 text-[0.875rem] transition-colors " +
                          (isActive
                            ? "border-[var(--pink)] text-[var(--cream)] font-medium"
                            : "border-transparent text-[var(--fg-muted)] hover:text-[var(--cream)] hover:border-[var(--border-strong)]")
                        }
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
