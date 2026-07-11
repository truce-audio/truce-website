"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type MiniSearch from "minisearch";

// Client-side docs search. The index is built at build time into
// public/search-index.json (see scripts/build-search-index.ts) and pulled
// once on first open, then queried in-browser with MiniSearch. Two
// triggers (the desktop nav button and the mobile dropdown item) open one
// shared modal by dispatching a window event, so the modal - and its
// MiniSearch instance - mounts a single time at the Nav root.

const OPEN_EVENT = "truce-search-open";
const MAX_RESULTS = 12;

type SearchDoc = {
  id: number;
  title: string;
  section: string;
  href: string;
  headings: string;
  excerpt: string;
  text: string;
};

type Hit = Pick<SearchDoc, "title" | "section" | "href" | "excerpt">;

/** Open the search modal from anywhere (a no-op during SSR). */
export function openSearch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_EVENT));
  }
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/** A button that opens the search modal. `variant` picks nav vs. dropdown styling. */
export function SearchTrigger({ variant }: { variant: "desktop" | "mobile" }) {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
  }, []);

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={openSearch}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--cream)] hover:bg-[var(--bg-elevated)]"
      >
        <SearchIcon className="h-4 w-4" />
        Search
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Search docs"
      className="group flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]/60 px-2.5 py-1.5 text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--cream)]"
    >
      <SearchIcon className="h-3.5 w-3.5" />
      <span className="text-xs font-semibold">Search</span>
      <kbd className="rounded border border-[var(--border)] px-1 py-px text-[0.65rem] font-semibold text-[var(--fg-subtle)]">
        {isMac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}

let cachedDocs: SearchDoc[] | null = null;

async function loadDocs(): Promise<SearchDoc[]> {
  if (cachedDocs) return cachedDocs;
  const res = await fetch("/search-index.json");
  if (!res.ok) throw new Error(`search index ${res.status}`);
  cachedDocs = (await res.json()) as SearchDoc[];
  return cachedDocs;
}

export function SearchModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  const indexRef = useRef<MiniSearch<SearchDoc> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setActive(0);
  }, []);

  // Lazily fetch the corpus and load MiniSearch on first open, so neither
  // ships in the initial bundle for page loads that never search.
  const ensureIndex = useCallback(async () => {
    if (indexRef.current || status === "loading") return;
    setStatus("loading");
    try {
      const [{ default: MiniSearchCtor }, docs] = await Promise.all([
        import("minisearch"),
        loadDocs(),
      ]);
      const mini = new MiniSearchCtor<SearchDoc>({
        fields: ["title", "headings", "text"],
        storeFields: ["title", "section", "href", "excerpt"],
        searchOptions: {
          boost: { title: 4, headings: 2 },
          prefix: true,
          fuzzy: 0.2,
          combineWith: "AND",
        },
      });
      mini.addAll(docs);
      indexRef.current = mini;
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [status]);

  // Global open triggers: the shared window event and Cmd/Ctrl-K.
  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      void ensureIndex();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        void ensureIndex();
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [ensureIndex]);

  // Focus the input and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Run the query whenever it (or the index) changes.
  useEffect(() => {
    const mini = indexRef.current;
    if (!mini || !query.trim()) {
      setHits([]);
      setActive(0);
      return;
    }
    const results = mini.search(query).slice(0, MAX_RESULTS) as unknown as Hit[];
    setHits(results);
    setActive(0);
  }, [query, status]);

  // Keep the active row in view as the user arrows through results.
  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = useCallback(
    (hit: Hit | undefined) => {
      if (!hit) return;
      close();
      router.push(hit.href);
    },
    [close, router],
  );

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const emptyMessage = useMemo(() => {
    if (status === "loading") return "Loading search index...";
    if (status === "error") return "Search is unavailable right now.";
    if (query.trim() && hits.length === 0) return `No matches for "${query}".`;
    if (!query.trim()) return "Type to search the docs.";
    return "";
  }, [status, query, hits.length]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search docs"
    >
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
        onClick={close}
        tabIndex={-1}
      />
      <div className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
          <SearchIcon className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search the docs"
            className="w-full bg-transparent py-3.5 text-sm text-[var(--cream)] outline-none placeholder:text-[var(--fg-subtle)]"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search query"
          />
          <kbd className="hidden shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--fg-subtle)] sm:block">
            Esc
          </kbd>
        </div>

        {hits.length > 0 ? (
          <ul ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
            {hits.map((hit, i) => (
              <li key={hit.href}>
                <button
                  type="button"
                  onClick={() => go(hit)}
                  onMouseMove={() => setActive(i)}
                  className={
                    "flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors " +
                    (i === active
                      ? "bg-[var(--bg)]"
                      : "hover:bg-[var(--bg)]/60")
                  }
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--cream)]">
                      {hit.title}
                    </span>
                    <span className="shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
                      {hit.section}
                    </span>
                  </span>
                  {hit.excerpt && (
                    <span className="line-clamp-1 text-xs text-[var(--fg-muted)]">
                      {hit.excerpt}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}
