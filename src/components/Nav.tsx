import Link from "next/link";
import { framework } from "@/content/framework";

const NAV_ITEM_CLASS =
  "nav-link relative px-3 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--cream)] transition-colors";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
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
        <div className="flex items-center gap-2">
          <Link href="/docs/guide/" className={NAV_ITEM_CLASS}>
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
      </nav>
    </header>
  );
}
