import { renderPrintable } from "./print-render";
import type { PrintableDocument } from "./types";

/**
 * The one place in the printables module that touches `window`.
 *
 * Kept apart from the renderer so `renderPrintable` stays a pure
 * `document -> string` that a node test can assert on. Everything below only
 * exists because a browser has to be handed the string.
 */

/**
 * Why a print attempt ended the way it did.
 *
 * `openPrintable` returns this rather than `void` because the failure that
 * actually happens in the field — the browser swallowing the new tab — is
 * completely silent. The user clicks Print, nothing appears, and the app looks
 * broken. The caller is expected to toast on anything other than `"opened"`,
 * e.g. "Allow pop-ups for this site to print the document."
 */
export type PrintOpenResult = "opened" | "popup_blocked" | "unavailable";

/**
 * Backstop for the fallback path's object URL. One minute is long enough for
 * the tab to paint and short enough that a session of printing does not
 * accumulate documents in memory. The main path mints no URL at all.
 */
const REVOKE_AFTER_MS = 60_000;

/**
 * Render a document and open it in a new tab, ready to print.
 *
 * The tab is opened BLANK and the markup is written into it. The obvious
 * alternative — mint a `blob:` URL and `window.open` that — is what this used
 * to do, and it put the blob URL in the new tab's address bar, where it is not
 * a document location so much as a live grenade:
 *
 *   - Chrome renders a failed or intercepted `blob:` navigation by leaving the
 *     raw URL sitting in the omnibox. A teller who nudges Enter searches Google
 *     for `blob:http://localhost:3000/2079f4ad-…` and lands on a results page
 *     instead of the loan's disclosure statement. That is the bug this fixes,
 *     reported from an actual counter.
 *   - The URL is revocable, so it also had to be revoked, and the listener that
 *     did it was attached to the OPENER's handle on the new window — where the
 *     `load` that fires first belongs to the initial empty document, not to the
 *     blob. Revoking there pulls the URL out from under the navigation it was
 *     created for.
 *   - Extensions and enterprise policy block top-level `blob:` navigation
 *     outright, and the block is silent.
 *
 * Writing into `about:blank` has none of those problems: nothing is minted, so
 * nothing leaks and nothing can be revoked early; the address bar holds
 * `about:blank`, which searches for nothing; and the document is same-origin
 * with the app, so the toolbar's `window.print()` and `window.close()` still
 * work. The tab cannot be hard-reloaded, which the in-page Print button already
 * made unnecessary.
 *
 * Never throws.
 */
export function openPrintable(doc: PrintableDocument): PrintOpenResult {
  if (typeof window === "undefined") return "unavailable";

  const html = renderPrintable(doc);

  let win: Window | null = null;
  try {
    win = window.open("", "_blank");
  } catch {
    win = null;
  }

  if (!win) return "popup_blocked";

  let written = false;
  try {
    const target = win.document;
    target.open();
    target.write(html);
    // Without this the tab spins forever: the document stays open for further
    // writes and never reaches `load`, so the print dialog opens against a
    // document the browser still considers unfinished.
    target.close();
    written = true;
  } catch {
    written = false;
  }

  // A nicety, and separately guarded: a browser that refuses `focus()` has not
  // failed to open the document.
  try {
    win.focus();
  } catch {
    // Nothing to do — the tab is open either way.
  }

  return written ? "opened" : openViaBlob(win, html);
}

/**
 * Hand the tab a URL instead of writing into it.
 *
 * Only for a browser that will not let the opener reach `win.document` at all.
 * It carries the address-bar problem described above, which is exactly why it
 * is the fallback and not the path everyone takes.
 */
function openViaBlob(win: Window, html: string): PrintOpenResult {
  let url: string;
  try {
    url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  } catch {
    return "unavailable";
  }

  try {
    win.location.href = url;
  } catch {
    // Nothing will ever display it, so it is released rather than leaked.
    URL.revokeObjectURL(url);
    return "unavailable";
  }

  // A timer and nothing else. The `load` listener this replaces was registered
  // on the opener's view of the new window, whose initial empty document fires
  // `load` before the blob navigation commits — so it revoked the URL the tab
  // was in the middle of loading.
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  return "opened";
}
