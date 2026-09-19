/**
 * The document behind a journal entry: what it was, what to call it, and
 * whether this app can open it.
 *
 * The server sends three fields — `postable_type`, `postable_id` and
 * `postable_label` — and every one of them is allowed to be missing. Two rules
 * come out of that and both live here rather than in a component:
 *
 * 1. **The type is an open vocabulary.** It is an API alias, never a class
 *    name, and an unmapped class falls back to a snake-cased basename. So a
 *    type this file has never heard of is an ordinary case, not an error: it
 *    gets a humanised name and no link.
 * 2. **A link is only offered where a route exists.** `loan` and `repayment`
 *    have detail pages; `expense` has a list but no detail page, and
 *    `expense_payment` has nothing at all. Linking them anyway would send the
 *    user to a 404, so those render as text. {@see POSTABLE_ROUTES} is the
 *    only place that decision is made.
 *
 * `postable_label` is `whenLoaded` server-side, so its KEY can be absent from
 * the payload. That is indistinguishable from null here and deliberately
 * treated as such — an entry with a type but no label is still a real,
 * openable document, it just has to be named by its id.
 */

import type { JournalEntry, JournalPostableType } from "@/types/accounting";

/** The source document, resolved for display. */
export interface JournalSourceDocument {
  /** The alias exactly as the server sent it. */
  type: JournalPostableType;
  /** Null when the server sent a type without an id. */
  id: number | null;
  /** The document's own identifier, when the server resolved one. */
  label: string | null;
  /** The kind, in this app's words: "Loan", "Payment", "Expense". */
  typeLabel: string;
  /**
   * What to show. The label when there is one ("Loan LN-000154"), the id when
   * there is not ("Loan #48"), and the bare kind when there is neither.
   * Always qualified by the kind, because this text appears where nothing else
   * says what the document is.
   */
  text: string;
  /** An in-app route, or null when this kind has no page to open. */
  href: string | null;
}

/**
 * Types that have somewhere to go.
 *
 * `expense` is absent on purpose: `/accounting/expenses` is a list with no
 * detail route, and deep-linking to a list that cannot select a row is worse
 * than not linking. `expense_payment` has no page of any kind. Adding either
 * one means shipping the route first.
 */
const POSTABLE_ROUTES: Record<string, ((id: number) => string) | undefined> = {
  loan: (id) => `/loans/${id}`,
  // A repayment's detail page is the receipt, keyed by the repayment id —
  // which is exactly what `postable_id` carries.
  repayment: (id) => `/payments/${id}`,
};

/**
 * What this app calls each kind. `repayment` is "Payment" because that is the
 * word the navigation, the route and the screen it opens all use; the alias is
 * the server's vocabulary, not the user's.
 */
const POSTABLE_NAMES: Record<string, string | undefined> = {
  loan: "Loan",
  repayment: "Payment",
  expense: "Expense",
  expense_payment: "Expense payment",
};

/** "expense_payment" → "expense payment". Matches how the register renders `source`. */
function humanise(type: string): string {
  return type.replace(/_/g, " ");
}

/**
 * Resolve an entry's source document, or null when it has none.
 *
 * Null is the common, correct answer: fund transfers, reversals and manual
 * entries all legitimately have no postable, and roughly every register
 * contains them.
 */
export function sourceDocument(
  entry: Pick<JournalEntry, "postable_type" | "postable_id" | "postable_label">
): JournalSourceDocument | null {
  const type = entry.postable_type?.trim();
  if (!type) return null;

  const id =
    typeof entry.postable_id === "number" && Number.isFinite(entry.postable_id)
      ? entry.postable_id
      : null;
  // An absent key and an explicit null are the same fact, and so is a blank
  // string: the server could not name the document.
  const label = entry.postable_label?.trim() || null;
  const typeLabel = POSTABLE_NAMES[type] ?? humanise(type);

  const route = POSTABLE_ROUTES[type];

  return {
    type,
    id,
    label,
    typeLabel,
    text: label
      ? `${typeLabel} ${label}`
      : id !== null
        ? `${typeLabel} #${id}`
        : typeLabel,
    href: route && id !== null ? route(id) : null,
  };
}
