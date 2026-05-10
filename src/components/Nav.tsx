import Link from "next/link";
import { framework } from "@/content/framework";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-semibold tracking-tight"
          aria-label={`${framework.domain} home`}
        >
          {/* Inline mark — kept inline so we can recolor with currentColor if needed */}
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
          <span>{framework.domain}</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/docs"
            className="rounded-md px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
          >
            Docs
          </Link>
          <Link
            href="/plugins"
            className="rounded-md px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
          >
            Plugins
          </Link>
          <a
            href={framework.github}
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
          >
            GitHub
          </a>
        </div>
      </nav>
    </header>
  );
}
