"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { framework } from "@/content/framework";
import type { SidebarSection } from "@/lib/docs";
import { TitleWithCode } from "@/components/TitleWithCode";

const NAV_ITEM_CLASS =
  "nav-link relative px-3 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--cream)] transition-colors";

const MOBILE_ITEM_CLASS =
  "block px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--cream)] hover:bg-[var(--bg-elevated)]";

function HamburgerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function Nav({ docsSections }: { docsSections: SidebarSection[] }) {
  const pathname = usePathname() ?? "";
  const isDocsRoute = pathname.startsWith("/docs");

  // Close any open <details.nav-menu> dropdown after a route change.
  useEffect(() => {
    document
      .querySelectorAll<HTMLDetailsElement>("details.nav-menu[open]")
      .forEach((el) => el.removeAttribute("open"));
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur">
      <nav className="relative mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label={`${framework.domain} home`}
        >
          <svg
            viewBox="0 0 64 64"
            className="h-6 w-6 transition-transform duration-300 group-hover:rotate-[8deg]"
            aria-hidden="true"
          >
            <path
              d="M 8 32 C 14 16, 22 16, 32 32 C 42 48, 50 48, 56 32"
              fill="none"
              stroke="#FF2D7B"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M 8 32 C 14 48, 22 48, 32 32 C 42 16, 50 16, 56 32"
              fill="none"
              stroke="#14F0E0"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <circle cx="32" cy="32" r="3" fill="#F0E4D0" />
          </svg>
          <span className="nav-link text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--cream)]">
            {framework.domain}
          </span>
        </Link>

        {/* Desktop site nav. Hidden until lg on docs routes (we merge into the
            hamburger there), and until sm everywhere else. */}
        <div
          className={`hidden items-center gap-2 ${isDocsRoute ? "lg:flex" : "sm:flex"}`}
        >
          <Link href="/docs/" className={NAV_ITEM_CLASS}>
            Docs
          </Link>
          <Link href="/plugins" className={NAV_ITEM_CLASS}>
            Plugins
          </Link>
          <a
            href={framework.github}
            target="_blank"
            rel="noreferrer"
            className={NAV_ITEM_CLASS}
          >
            GitHub
          </a>
          <Link
            href="/docs/guide/install/"
            className="ml-2 inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-accent-fg transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>

        {/* Hamburger. On docs routes: hidden lg+; on other routes: hidden sm+.
            That covers the gap (sm–lg) where the docs sidebar isn't yet visible. */}
        <details className={`nav-menu ${isDocsRoute ? "lg:hidden" : "sm:hidden"}`}>
          <summary
            aria-label="Open menu"
            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-[var(--border-strong)] text-[var(--cream)] hover:bg-[var(--bg-elevated)]"
          >
            <HamburgerIcon />
          </summary>
          <div className="absolute right-4 top-full mt-2 w-72 max-h-[80vh] overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg">
            {/* Site nav items inside the dropdown. Mirrors the visibility of the
                inline desktop nav — shown until that nav takes over. */}
            <div className={`py-1 ${isDocsRoute ? "lg:hidden" : "sm:hidden"}`}>
              <Link href="/docs/" className={MOBILE_ITEM_CLASS}>
                Docs
              </Link>
              <Link href="/plugins" className={MOBILE_ITEM_CLASS}>
                Plugins
              </Link>
              <a
                href={framework.github}
                target="_blank"
                rel="noreferrer"
                className={MOBILE_ITEM_CLASS}
              >
                GitHub
              </a>
              <Link
                href="/docs/guide/install/"
                className={`${MOBILE_ITEM_CLASS} bg-accent text-accent-fg hover:bg-accent hover:opacity-90`}
              >
                Get started
              </Link>
            </div>

            {docsSections.length > 0 && (
              <div className="border-t border-[var(--border)] py-2">
                {docsSections.map((section) => (
                  <div key={section.title} className="mb-2 last:mb-0">
                    <div className="px-4 pt-2 pb-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
                      {section.title}
                    </div>
                    {section.items.map((item) => {
                      const isActive = item.href === pathname;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={
                            "block px-4 py-1.5 text-sm transition-colors " +
                            (isActive
                              ? "text-[var(--cream)] font-medium border-l-2 border-[var(--pink)] -ml-px"
                              : "text-[var(--fg-muted)] hover:text-[var(--cream)] hover:bg-[var(--bg)]")
                          }
                        >
                          <TitleWithCode text={item.title} />
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </nav>
    </header>
  );
}
