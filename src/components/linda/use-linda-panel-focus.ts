"use client";

import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { isTabbable, nextTabIndex } from "@/lib/focus-wrap";

/** The header button that opens Linda; focus returns to it on close. */
export const LINDA_TRIGGER_ID = "linda-trigger";

/** Everything that might take focus; `isTabbable` then drops what can't. */
const FOCUS_CANDIDATES = "a[href], button, input, select, textarea, [tabindex]";

/**
 * The elements Tab can reach inside `container`, in order. A disabled button
 * can keep tabindex="0" (Base UI's does), so disabled, aria-disabled, hidden
 * and inert elements are read explicitly rather than trusted to the selector.
 */
function tabbables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUS_CANDIDATES)).filter((el) =>
    isTabbable({
      tabIndex: el.tabIndex,
      disabled: el.matches(":disabled") || el.getAttribute("aria-disabled") === "true",
      hidden: el.closest("[hidden], [inert]") !== null || el.getClientRects().length === 0,
    }),
  );
}

/**
 * Tab and Shift+Tab move through `container` only, wrapping at both ends.
 * Every Tab is handled here rather than left to the browser, so focus cannot
 * slip out past an element the browser and this list disagree about.
 */
function wrapTab(e: KeyboardEvent<HTMLElement>, container: HTMLElement) {
  e.preventDefault();
  const items = tabbables(container);
  const current = items.indexOf(document.activeElement as HTMLElement);
  const next = nextTabIndex(items.length, current, e.shiftKey);
  if (next >= 0) items[next].focus();
}

/**
 * Focus for Linda's panel.
 *
 * - `modal` (phones, where the panel covers the screen): focus moves into the
 *   panel, Tab stays inside it, and everything beside it in the app shell is
 *   inert, so nothing hidden behind it can be reached.
 * - Closing hands focus back to the header button when it was in the panel.
 *   Otherwise it would drop to the page as the panel turns inert.
 *
 * Returns the panel's keydown handler for the Tab wrap.
 */
export function useLindaPanelFocus(
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  modal: boolean,
) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!modal || !panel) return;
    const behind = Array.from(panel.parentElement?.children ?? []).filter(
      (el): el is HTMLElement => el !== panel && el instanceof HTMLElement && !el.inert,
    );
    for (const el of behind) el.inert = true;
    panel.focus({ preventScroll: true });
    return () => {
      for (const el of behind) el.inert = false;
    };
  }, [modal, panelRef]);

  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) {
      const active = document.activeElement;
      if (!active || active === document.body || panelRef.current?.contains(active)) {
        document.getElementById(LINDA_TRIGGER_ID)?.focus();
      }
    }
    wasOpen.current = open;
  }, [open, panelRef]);

  return (e: KeyboardEvent<HTMLElement>) => {
    if (modal && e.key === "Tab" && panelRef.current) wrapTab(e, panelRef.current);
  };
}
