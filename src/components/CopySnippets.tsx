"use client";

import { useEffect } from "react";

/**
 * Wires up copy-to-clipboard for any `[data-copy]` button rendered inside the
 * static doc HTML (which is injected via dangerouslySetInnerHTML and so cannot
 * host React components of its own). Mount once per page; it delegates clicks
 * from the document, copies the button's `data-copy` value, and briefly swaps
 * the label to "Copied" for feedback.
 */
export function CopySnippets() {
  useEffect(() => {
    const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

    async function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLElement>("[data-copy]");
      if (!button) return;

      const text = button.dataset.copy ?? "";
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return;
      }

      const original = button.dataset.label ?? button.textContent ?? "";
      button.dataset.label = original;
      button.textContent = "Copied";

      const existing = timers.get(button);
      if (existing) clearTimeout(existing);
      timers.set(
        button,
        setTimeout(() => {
          button.textContent = original;
        }, 1500),
      );
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
