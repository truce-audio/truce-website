import Link from "next/link";
import { framework } from "@/content/framework";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/wordmark.svg"
          alt={framework.domain}
          className="h-36 w-auto select-none opacity-90"
          draggable={false}
        />
        <Link
          href="/privacy"
          className="text-sm text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]"
        >
          Privacy
        </Link>
      </div>
    </footer>
  );
}
