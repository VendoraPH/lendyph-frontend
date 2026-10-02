"use client";

import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

/** The header button that opens Linda; focus returns to it on close. */
export const LINDA_TRIGGER_ID = "linda-trigger";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tab and Shift+Tab wrap around inside `container` instead of leaving it. */
function wrapTab(e: KeyboardEvent<HTMLElement>, container: HTMLElement) {
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
  if (items.length === 0) {
    e.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const current = document.activeElement;
  if (e.shiftKey && (current === first || current === container)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && current === last) {
    e.preventDefault();
    first.focus();
  }
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
