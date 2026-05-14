import Image from "next/image";
import Link from "next/link";
import type { Plugin } from "@/content/plugins";

export function PluginCard({ plugin }: { plugin: Plugin }) {
  return (
    <Link
      href={`/plugins/${plugin.slug}`}
      className="group block overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] transition-colors hover:border-[var(--border-strong)]"
    >
      {/*
        `object-contain` instead of `object-cover` so portrait
        editor screenshots show the whole UI (knobs + headers)
        with side bars from the card background, rather than
        getting cropped to a horizontal strip across the middle.
      */}
      <div className="aspect-[16/9] overflow-hidden bg-[var(--bg-code)]">
        <Image
          src={plugin.heroScreenshot.src}
          alt={plugin.heroScreenshot.alt}
          width={1200}
          height={675}
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
      <div className="p-5">
        <h3 className="font-semibold">{plugin.name}</h3>
        <p className="mt-1 text-sm text-[var(--fg-muted)] leading-relaxed">
          {plugin.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {plugin.formats.map((f) => (
            <span
              key={f}
              className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--fg-muted)]"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
