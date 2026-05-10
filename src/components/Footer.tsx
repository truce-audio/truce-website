import { framework } from "@/content/framework";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-24">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <span className="nav-link text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--cream)]">
          {framework.domain}
        </span>
      </div>
    </footer>
  );
}
