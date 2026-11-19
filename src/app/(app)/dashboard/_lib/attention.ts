/**
 * "Requires Attention", from `GET /dashboard/executive/attention` (EB-D2).
 * The server evaluates each rule against the thresholds in the dashboard
 * settings and words it; this only orders the rules and puts their state, and
 * the period or day they read, in words. No threshold lives in the browser.
 */

import { formatDate } from "@/lib/format";
import type { AttentionState, ExecutiveAttention, ExecutiveFilterKey } from "@/types/executive-dashboard";
import { figureFilterNote } from "./executive-books";

export const ATTENTION_STATE_TEXT: Record<AttentionState, string> = {
  needs_attention: "Needs attention",
  clear: "Clear",
  no_access: "Not available",
  no_data: "No data",
  no_snapshot: "No snapshot for this date",
  requires_configuration: "Requires configuration",
};

export type AttentionTone = "attention" | "clear" | "neutral";

const TONE: Record<AttentionState, AttentionTone> = {
  needs_attention: "attention",
  clear: "clear",
  no_access: "neutral",
  no_data: "neutral",
  no_snapshot: "neutral",
  requires_configuration: "neutral",
};

/** Rules read over the selected period; every other rule reads one day (`as_of`). */
const PERIOD_RULES = new Set(["collection_efficiency"]);

export interface AttentionRow {
  key: string;
  label: string;
  stateText: string;
  tone: AttentionTone;
  title: string;
  detail: string;
  /** Where to look into it; none for a rule the caller can't read. */
  href: string | null;
  /** "For <the period>" or "As of <day>". */
  basis: string;
  filterNote: string | null;
}

export interface AttentionView {
  /** How many rules need attention. */
  count: number;
  rows: AttentionRow[];
}

const range = (from: string, to: string) => (from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`);

/** Every rule: those needing attention first, then those that can't be judged, then the clear ones; the server's order within each. */
export function attentionView(response: ExecutiveAttention, sent: readonly ExecutiveFilterKey[]): AttentionView {
  const rows = response.rules.map((rule) => ({
    key: rule.key,
    label: rule.label,
    stateText: ATTENTION_STATE_TEXT[rule.state] ?? rule.state,
    tone: TONE[rule.state] ?? "neutral",
    title: rule.title,
    detail: rule.detail,
    href: rule.state === "no_access" ? null : rule.link,
    basis: PERIOD_RULES.has(rule.key)
      ? `For ${range(response.period.from, response.period.to)}`
      : `As of ${formatDate(rule.as_of ?? response.as_of)}`,
    filterNote: figureFilterNote(sent, response, rule.key),
  }));
  // Needs attention first, then the rules that can't be judged, then the clear ones.
  const group = (tone: AttentionTone) => rows.filter((r) => r.tone === tone);
  const first = group("attention");
  return { count: first.length, rows: [...first, ...group("neutral"), ...group("clear")] };
}
