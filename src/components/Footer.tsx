import { framework } from "@/content/framework";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-24">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between text-sm text-[var(--fg-muted)]">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-[var(--fg)]">{framework.domain}</span>
          <span>Licensed {framework.license}.</span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <a
            href={framework.github}
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--fg)]"
          >
            GitHub
          </a>
          <a
            href={framework.rustdoc}
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--fg)]"
          >
            Rustdoc
          </a>
          <a
            href={`${framework.github}/issues`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--fg)]"
          >
            Issues
          </a>
          <a href="/docs" className="hover:text-[var(--fg)]">
            Docs
          </a>
        </div>
      </div>
    </footer>
  );
}
