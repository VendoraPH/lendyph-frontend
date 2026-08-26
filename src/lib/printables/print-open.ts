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
 * Backstop for a browser that never fires `load` on the blob document (or where
 * the listener cannot be attached). One minute is long enough for the tab to
 * paint and short enough that a session of printing does not accumulate
 * documents in memory.
 */
const REVOKE_AFTER_MS = 60_000;

/**
 * Render a document and open it in a new tab, ready to print.
 *
 * The object URL is revoked once the new tab has loaded. The code this replaces
 * (`loans/[id]/page.tsx`) never revoked, so every document a teller opened
 * pinned its own HTML in memory for the life of the page — and a collection day
 * is a lot of documents. Revoking after load is safe: the tab already holds the
 * parsed document. The only thing it costs is the ability to hard-reload that
 * tab, which the in-page Print button makes unnecessary.
 *
 * Never throws. A blocked pop-up releases the URL immediately rather than
 * leaking a blob nothing will ever display.
 */
export function openPrintable(doc: PrintableDocument): PrintOpenResult {
  if (typeof window === "undefined") return "unavailable";

  const html = renderPrintable(doc);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));

  let win: Window | null = null;
  try {
    // Deliberately no "noopener": that feature string makes window.open return
    // null, which is indistinguishable from a blocked pop-up and would leave
    // the URL unrevocable. The content is this app's own markup, so there is
    // nothing to protect the opener from.
    win = window.open(url, "_blank");
  } catch {
    win = null;
  }

  if (!win) {
    URL.revokeObjectURL(url);
    return "popup_blocked";
  }

  const revoke = () => URL.revokeObjectURL(url);
  try {
    win.addEventListener("load", revoke, { once: true });
    win.focus();
  } catch {
    // Some browsers restrict reaching into the new window. The timer below
    // still frees the blob; revoking twice is a no-op.
  }
  window.setTimeout(revoke, REVOKE_AFTER_MS);

  return "opened";
}
