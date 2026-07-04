"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { framework } from "@/content/framework";
import type { SidebarSection } from "@/lib/docs";
import { TitleWithCode } from "@/components/TitleWithCode";

// Four-corner snap state for the floating hamburger on mobile. Persisted
// across page navs in localStorage; the swoop on the logo mirrors which
// horizontal half the hamburger has been parked in.
type Corner = "tl" | "tr" | "bl" | "br";

const DEFAULT_CORNER: Corner = "tr";
const CORNER_STORAGE_KEY = "truce-nav-corner";
// Pixel distance the pointer must travel before we count the gesture as
// a drag (and suppress the dropdown toggle on the subsequent click).
const DRAG_THRESHOLD_PX = 6;
// Inset from the viewport edge when snapped.
const SNAP_INSET_PX = 12;
// Half the hamburger button's pixel size (h-9 w-9 = 36px), used to
// center it under the pointer while dragging.
const BUTTON_HALF_PX = 18;

const NAV_ITEM_CLASS =
  "nav-link relative px-3 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--cream)] transition-colors";

const MOBILE_ITEM_CLASS =
  "block px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--cream)] hover:bg-[var(--bg-elevated)]";

const SNAP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function HamburgerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function nearestCornerOf(
  x: number,
  y: number,
  w: number,
  h: number,
): Corner {
  const left = x < w / 2;
  const top = y < h / 2;
  if (top) return left ? "tl" : "tr";
  return left ? "bl" : "br";
}

function cornerInset(corner: Corner): React.CSSProperties {
  const inset = `${SNAP_INSET_PX}px`;
  switch (corner) {
    case "tl":
      return { top: inset, left: inset };
    case "tr":
      return { top: inset, right: inset };
    case "bl":
      return { bottom: inset, left: inset };
    case "br":
      return { bottom: inset, right: inset };
  }
}

// Where the dropdown panel attaches to the summary, given the corner the
// button is parked in. Pop down for top-corners, up for bottom-corners;
// align left for left-corners, right for right-corners.
function dropdownAnchorClasses(corner: Corner): string {
  const v =
    corner === "tl" || corner === "tr" ? "top-full mt-2" : "bottom-full mb-2";
  const h = corner === "tl" || corner === "bl" ? "left-0" : "right-0";
  return `${v} ${h}`;
}

export function Nav({ docsSections }: { docsSections: SidebarSection[] }) {
  const pathname = usePathname() ?? "";
  const isDocsRoute = pathname.startsWith("/docs");

  const [corner, setCorner] = useState<Corner>(DEFAULT_CORNER);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [mobileViewport, setMobileViewport] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    pid: number;
    moved: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);

  // Restore the saved corner after mount (avoids hydration mismatch on
  // the initial render, which always uses DEFAULT_CORNER).
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(CORNER_STORAGE_KEY);
      if (v === "tl" || v === "tr" || v === "bl" || v === "br") setCorner(v);
    } catch {
      // localStorage can be disabled (private browsing, etc.) - ignore.
    }
  }, []);

  // Persist corner changes.
  useEffect(() => {
    try {
      window.localStorage.setItem(CORNER_STORAGE_KEY, corner);
    } catch {
      // ignore
    }
  }, [corner]);

  // Track whether the hamburger is currently the visible nav control. On
  // docs routes it shows below `lg` (1024px); elsewhere below `sm` (640px).
  // The logo's swoop is gated on this so it doesn't reorder on desktop.
  useEffect(() => {
    const q = isDocsRoute
      ? "(max-width: 1023.98px)"
      : "(max-width: 639.98px)";
    const mq = window.matchMedia(q);
    const update = () => setMobileViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [isDocsRoute]);

  // Close any open <details.nav-menu> dropdown after a route change.
  useEffect(() => {
    document
      .querySelectorAll<HTMLDetailsElement>("details.nav-menu[open]")
      .forEach((el) => el.removeAttribute("open"));
  }, [pathname]);

  // Close the dropdown when a tap lands outside the <details>. Native
  // <details> doesn't dismiss on outside clicks; we add a `pointerdown`
  // listener so the close feels snappy on touch (firing before the
  // browser's synthetic click). Taps on links inside the dropdown
  // still navigate normally - the route-change effect above handles
  // dismissal in that case.
  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      const details = detailsRef.current;
      if (!details || !details.open) return;
      const target = e.target as Node | null;
      if (target && !details.contains(target)) {
        details.open = false;
      }
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      pid: e.pointerId,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      d.moved = true;
      // If the user opened the dropdown then immediately starts dragging,
      // close it - we don't want a 72x?-wide panel sliding around.
      if (detailsRef.current?.open) detailsRef.current.open = false;
    }
    if (d.moved) setDragPos({ x: e.clientX, y: e.clientY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    if (d.moved) {
      const next = nearestCornerOf(
        e.clientX,
        e.clientY,
        window.innerWidth,
        window.innerHeight,
      );
      setCorner(next);
      setDragPos(null);
      // Suppress the synthetic click event that <details> would otherwise
      // turn into an open/close toggle right after the drag ends.
      justDraggedRef.current = true;
      window.setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);
    }
    dragRef.current = null;
  };

  const onSummaryClick = (e: React.MouseEvent) => {
    if (justDraggedRef.current) e.preventDefault();
  };

  // Hamburger style: when dragging, follow the pointer with no transition;
  // when idle, snap to the corner inset with an eased transition so the
  // user sees a smooth swoop into place.
  const transitionAll = `top 0.4s ${SNAP_EASE}, left 0.4s ${SNAP_EASE}, right 0.4s ${SNAP_EASE}, bottom 0.4s ${SNAP_EASE}`;
  const detailsStyle: React.CSSProperties = dragPos
    ? {
        position: "fixed",
        top: dragPos.y - BUTTON_HALF_PX,
        left: dragPos.x - BUTTON_HALF_PX,
        right: "auto",
        bottom: "auto",
      }
    : {
        position: "fixed",
        ...cornerInset(corner),
        transition: transitionAll,
      };

  // Logo swoop: when the hamburger is parked on the left half of the
  // viewport on mobile, the logo slides to the right side of the header
  // so the two anchor each corner of the bar. On desktop (where the
  // hamburger is hidden and the inline nav is present) the logo stays
  // put regardless of the saved corner.
  const logoOnRight = mobileViewport && (corner === "tl" || corner === "bl");
  const logoStyle: React.CSSProperties = {
    transition: `transform 0.5s ${SNAP_EASE}`,
    transform: logoOnRight ? "translateX(calc(100vw - 100% - 32px))" : "translateX(0)",
  };

  const dropdownClasses = `absolute ${dropdownAnchorClasses(corner)} w-72 max-h-[80vh] overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg`;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur">
      <nav className="relative mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label={`${framework.domain} home`}
          style={logoStyle}
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

        {/* Desktop site nav. Hidden until lg on docs routes (we merge into the
            hamburger there), and until sm everywhere else. */}
        <div
          className={`hidden items-center gap-2 ${isDocsRoute ? "lg:flex" : "sm:flex"}`}
        >
          <Link href="/docs/" className={NAV_ITEM_CLASS}>
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
        </div>

        {/* Hamburger floats. On docs routes: hidden lg+; on other routes:
            hidden sm+. position:fixed takes it out of the nav flexbox so
            it can park in any viewport corner. */}
        <details
          ref={detailsRef}
          className={`nav-menu z-40 ${isDocsRoute ? "lg:hidden" : "sm:hidden"}`}
          style={detailsStyle}
        >
          <summary
            aria-label="Open menu"
            className="flex h-9 w-9 cursor-grab touch-none select-none list-none items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)]/95 text-[var(--cream)] shadow-md backdrop-blur hover:bg-[var(--bg-elevated)] active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onSummaryClick}
          >
            <HamburgerIcon />
          </summary>
          <div className={dropdownClasses}>
            {/* Site nav items inside the dropdown. Mirrors the visibility of the
                inline desktop nav — shown until that nav takes over. */}
            <div className={`py-1 ${isDocsRoute ? "lg:hidden" : "sm:hidden"}`}>
              <Link href="/docs/" className={MOBILE_ITEM_CLASS}>
                Docs
              </Link>
              <Link href="/plugins" className={MOBILE_ITEM_CLASS}>
                Plugins
              </Link>
              <a
                href={framework.github}
                target="_blank"
                rel="noreferrer"
                className={MOBILE_ITEM_CLASS}
              >
                GitHub
              </a>
            </div>

            {docsSections.length > 0 && (
              <div className="border-t border-[var(--border)] py-2">
                {docsSections.map((section) => (
                  <div key={section.title} className="mb-2 last:mb-0">
                    <div className="px-4 pt-2 pb-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
                      {section.title}
                    </div>
                    {section.items.map((item) => {
                      const isActive = item.href === pathname;
                      const itemClass =
                        "block px-4 py-1.5 text-sm transition-colors " +
                        (isActive
                          ? "text-[var(--cream)] font-medium border-l-2 border-[var(--pink)] -ml-px"
                          : "text-[var(--fg-muted)] hover:text-[var(--cream)] hover:bg-[var(--bg)]");
                      return item.external ? (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className={itemClass}
                        >
                          <TitleWithCode text={item.title} />
                        </a>
                      ) : (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={itemClass}
                        >
                          <TitleWithCode text={item.title} />
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </nav>
    </header>
  );
}
