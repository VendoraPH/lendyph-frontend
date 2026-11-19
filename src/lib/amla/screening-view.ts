import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { AmlaOption } from "@/lib/amla/settings-view";
import type {
  AmlaOrder,
  AmlaOrderBody,
  AmlaOrderDetail,
  AmlaScreeningMatch,
  AmlaScreeningMatchDetail,
  AmlaWatchlist,
} from "@/types/amla-screening";

/**
 * AMLA screening and orders in words (Phase 6, AMLA-B5). The server matches,
 * scores, places and lifts everything; these helpers only word what it sends
 * and check the forms for what is plainly missing before it decides.
 */

type Result<T> = { body: T } | { error: string };

const NA = "Data not available";

/** `AmlaScreeningMatch::STATUSES`. */
export const AMLA_MATCH_STATUS_OPTIONS: readonly AmlaOption[] = [
  { value: "pending", label: "Pending review" },
  { value: "confirmed", label: "Confirmed match" },
  { value: "cleared", label: "Cleared as a false positive" },
];

/** `AmlaScreeningPresenter::SUBJECT_TYPES`. */
export const AMLA_MATCH_SUBJECT_OPTIONS: readonly AmlaOption[] = [
  { value: "member", label: "Member" },
  { value: "walk_in", label: "Walk-in" },
  { value: "co_maker", label: "Co-maker" },
];

/** `AmlaOrder::AUTHORITIES` and `STATUSES`. */
export const AMLA_ORDER_AUTHORITY_OPTIONS: readonly AmlaOption[] = [
  { value: "amlc", label: "AMLC" },
  { value: "court", label: "Court" },
  { value: "other", label: "Other authority" },
];
export const AMLA_ORDER_STATUS_OPTIONS: readonly AmlaOption[] = [
  { value: "active", label: "In force" },
  { value: "released", label: "Released" },
];

/** The CSV template for AMLC and internal lists: `WatchlistParser::CSV_COLUMNS`, header only. */
export const AMLA_WATCHLIST_TEMPLATE = {
  fileName: "watchlist-template.csv",
  content: "reference,type,full_name,aliases,birth_year,nationality\n",
} as const;

export function amlaWatchlistView(list: AmlaWatchlist) {
  const active = list.active_version;
  let inForce = "No list uploaded yet.";
  let rescreen: string | null = null;
  if (active) {
    const entries = `${active.entry_count} ${active.entry_count === 1 ? "entry" : "entries"}`;
    inForce = `${active.version_label ?? `Version #${active.id}`}: ${entries}, uploaded by ${active.uploaded_by?.name ?? "a former user"}, ${formatDateTime(active.uploaded_at)}`;
    if (active.rescreen_pending) rescreen = "Everyone will be screened against it on the next screening run.";
    else if (active.rescreened_at) rescreen = `Everyone was screened against it ${formatDateTime(active.rescreened_at)}.`;
  }
  return {
    source: list.source,
    title: list.source_words,
    file: list.format === "xml" ? "The UN consolidated list's XML file" : "A CSV file made from the template",
    inForce,
    rescreen,
  };
}

/** The file must be the list's own kind; the server checks its size and contents and refuses in words. */
export function amlaWatchlistFileError(format: "xml" | "csv", fileName: string | null): string | null {
  const name = (fileName ?? "").toLowerCase();
  if (format === "xml") return name.endsWith(".xml") ? null : "Pick the UN consolidated list's XML file.";
  return name.endsWith(".csv") ? null : "Pick a CSV file made from the template.";
}

export function amlaMatchRow(match: AmlaScreeningMatch) {
  return {
    id: match.id,
    href: `/amla/screening/${match.id}`,
    subject: match.subject.name ?? NA,
    subjectType: match.subject.type_words,
    code: match.subject.code ?? "—",
    listed: match.entry.full_name,
    listing: `${match.entry.source_words} · ${match.entry.reference} · ${match.entry.kind_words}`,
    score: `Score ${match.score} (threshold ${match.threshold})`,
    status: match.status_words,
    pending: match.status === "pending",
    found: formatDateTime(match.found_at),
  };
}

export function amlaMatchLines(match: AmlaScreeningMatchDetail) {
  const listed = (values: string[] | undefined, none: string) => (values && values.length > 0 ? values.join("; ") : none);
  let decided: string | null = null;
  if (match.decided_at) {
    decided = `${match.status_words} by ${match.decided_by?.name ?? "a former user"}, ${formatDateTime(match.decided_at)}.`;
    if (match.decision_reason) decided += ` Reason: ${match.decision_reason}`;
  }
  return {
    reasons: [...match.reasons],
    listing: [
      ["Also known as", listed(match.entry.aliases, "None listed")],
      ["Birth year", listed(match.entry.birth_years, "Not listed")],
      ["Nationality", listed(match.entry.nationalities, "Not listed")],
      ["List version", match.version.label ?? `Version #${match.version.id}`],
    ] as [string, string][],
    decided,
    canDecide: match.status === "pending",
  };
}

const DECISION_MAX = 2000;

export function amlaDecisionReasonError(reason: string): string | null {
  const text = reason.trim();
  if (text === "") return "Give the reason for the decision.";
  return text.length > DECISION_MAX ? "Keep the reason to 2,000 characters." : null;
}

function holdLine(hold: AmlaOrder["holds"][number]): string {
  return `${hold.account_number ?? NA}: ${formatCurrency(hold.amount)}${hold.status_words ? ` (${hold.status_words})` : ""}`;
}

export function amlaOrderRow(order: AmlaOrder) {
  const holds = order.holds.map(holdLine);
  return {
    id: order.id,
    href: `/amla/orders/${order.id}`,
    reference: order.reference,
    authority: order.authority_words,
    member: order.member?.name ?? NA,
    code: order.member?.code ?? "—",
    received: formatDate(order.received_on),
    status: order.status_words,
    active: order.status === "active",
    holds: holds.length > 0 ? holds : ["No savings holds"],
  };
}

export function amlaOrderLines(order: AmlaOrderDetail) {
  const facts: [string, string][] = [
    ["Authority", order.authority_words],
    ["Received", formatDate(order.received_on)],
    ["Return due", order.return_due_on ? formatDate(order.return_due_on) : "Not set"],
    ["Placed", `By ${order.placed_by?.name ?? "a former user"}, ${formatDateTime(order.placed_at)}`],
    ["Required action", order.required_action],
  ];
  if (order.details) facts.push(["Details", order.details]);
  if (order.responsible_officer) facts.push(["Responsible officer", order.responsible_officer.name]);

  const p = order.pending_release;
  const pending = p
    ? `${p.requested_by?.name ?? "A former user"} asked for its release ${formatDateTime(p.requested_at)} (${p.release_reference}): ${p.reason}. A different sanctions holder approves or rejects it.`
    : null;
  const released =
    order.status === "released" && order.released_at
      ? `Released by ${order.released_by?.name ?? "a former user"}, ${formatDateTime(order.released_at)}, as asked by ${order.release_requested_by?.name ?? "a former user"}${order.release_reference ? ` (${order.release_reference})` : ""}: ${order.release_reason ?? "no reason given"}.`
      : null;
  return { facts, holds: order.holds.map(holdLine), pending, released };
}

export interface AmlaOrderForm {
  reference: string;
  authority: string;
  receivedOn: string;
  memberId: number | null;
  requiredAction: string;
  details: string;
  returnDueOn: string;
  holds: { accountId: string; amount: string }[];
}

const PESO = /^\d{1,10}(\.\d{1,2})?$/;

/** The order to record. Dates are YYYY-MM-DD, so they compare as text; the server checks balances and every limit. */
export function amlaOrderBody(form: AmlaOrderForm, today: string): Result<AmlaOrderBody> {
  const reference = form.reference.trim();
  const action = form.requiredAction.trim();
  if (reference === "") return { error: "Give the order's reference." };
  if (form.authority === "") return { error: "Pick who issued the order." };
  if (form.receivedOn === "") return { error: "Give the date the order was received." };
  if (form.receivedOn > today) return { error: "The received date can't be after today." };
  if (form.memberId === null) return { error: "Pick the member the order names." };
  if (action === "") return { error: "Say what the order requires." };
  if (form.returnDueOn !== "" && form.returnDueOn < form.receivedOn) return { error: "The return date can't be before the received date." };

  const holds: AmlaOrderBody["holds"] = [];
  for (const hold of form.holds) {
    if (hold.accountId === "") return { error: "Pick the account for each hold." };
    const amount = hold.amount.trim();
    if (!PESO.test(amount) || /^0+(\.0+)?$/.test(amount)) {
      return { error: "Each hold's amount is in pesos with up to two decimals, above ₱0.00." };
    }
    if (holds.some((h) => h.account_id === Number(hold.accountId))) {
      return { error: "Hold each account once; put the whole amount on one hold." };
    }
    holds.push({ account_id: Number(hold.accountId), amount });
  }

  const details = form.details.trim();
  return {
    body: {
      reference,
      authority: form.authority,
      received_on: form.receivedOn,
      borrower_id: form.memberId,
      required_action: action,
      ...(details !== "" ? { details } : {}),
      ...(form.returnDueOn !== "" ? { return_due_on: form.returnDueOn } : {}),
      holds,
    },
  };
}

export function amlaReleaseBody(form: { reason: string; reference: string }): Result<{ reason: string; release_reference: string }> {
  const reason = form.reason.trim();
  const reference = form.reference.trim();
  if (reason === "") return { error: "Give the reason for the release." };
  if (reference === "") return { error: "Give the reference of the order or resolution that lifts it." };
  return { body: { reason, release_reference: reference } };
}
