import { framework } from "@/content/framework";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-7xl justify-center px-4 py-8 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/wordmark.svg"
          alt={framework.domain}
          className="h-36 w-auto select-none opacity-90"
          draggable={false}
        />
      </div>
    </footer>
  );
}
