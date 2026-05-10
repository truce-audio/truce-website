"use client";

import { useEffect, useState } from "react";
import type { Platform } from "@/content/framework";

type Props = {
  platforms: Platform[];
  downloads?: Partial<Record<Platform, string>>;
};

export function DownloadButtons({ platforms, downloads }: Props) {
  const [detected, setDetected] = useState<Platform | null>(null);

  useEffect(() => {
    setDetected(detectPlatform(platforms));
  }, [platforms]);

  const ordered: Platform[] = detected
    ? [detected, ...platforms.filter((p) => p !== detected)]
    : platforms;

  return (
    <div className="flex flex-wrap gap-2">
      {ordered.map((platform, i) => {
        const url = downloads?.[platform];
        const primary = i === 0;
        if (url) {
          return (
            <a
              key={platform}
              href={url}
              target="_blank"
              rel="noreferrer"
              className={
                primary
                  ? "inline-flex items-center rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity"
                  : "inline-flex items-center rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--bg-elevated)] transition-colors"
              }
            >
              Download for {platform}
            </a>
          );
        }
        return (
          <span
            key={platform}
            aria-disabled="true"
            title="Installer not available yet"
            className="inline-flex items-center rounded-md border border-dashed border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--fg-muted)] cursor-not-allowed"
          >
            {platform} — coming soon
          </span>
        );
      })}
    </div>
  );
}

function detectPlatform(available: Platform[]): Platform | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  // iPad on iOS 13+ reports as Mac; treat as macOS for our purposes.
  if (/Mac|iPhone|iPad|iPod/i.test(ua) && available.includes("macOS")) return "macOS";
  if (/Win/i.test(ua) && available.includes("Windows")) return "Windows";
  if (/Linux|X11/i.test(ua) && available.includes("Linux")) return "Linux";
  return null;
}
