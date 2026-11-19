import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_OPTIONS } from "@/constants/payment-methods";

/**
 * The words for AMLA's rules, mirroring lendyph-backend (Phase 6, AMLA-B3 and
 * B4), so a stored key never shows. Used by the rule screens and by the
 * change-request lines approvers read.
 */

/** Detection rules A–L: `DetectionRule::words()`, in the server's order. */
export const AMLA_DETECTION_RULE_WORDS: Readonly<Record<string, string>> = {
  A: "Transaction structuring",
  B: "Unusual transaction frequency",
  C: "Unusual transaction volume",
  D: "Income and transaction mismatch",
  E: "Rapid movement of funds",
  F: "Repeated deposits and withdrawals",
  G: "Third party transactions",
  H: "GCash and digital payment anomalies",
  I: "Loan related anomalies",
  J: "Cross branch transaction patterns",
  K: "Missing or inconsistent identity information",
  L: "Relevant watchlist matches",
};

/** `AmlaAlert::PRIORITY_WORDS`. */
export const AMLA_PRIORITY_WORDS: Readonly<Record<string, string>> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export type AmlaParamKind = "count" | "days" | "multiplier" | "percent" | "peso" | "channels";

/** Each detection rule parameter's words and kind (`DetectionRule::parameters()`). */
export const AMLA_PARAM_WORDS: Readonly<Record<string, { label: string; kind: AmlaParamKind }>> = {
  min_transactions: { label: "Fewest transactions", kind: "count" },
  multiplier: { label: "Times the usual", kind: "multiplier" },
  baseline_days: { label: "Days of history compared", kind: "days" },
  min_amount: { label: "Smallest amount", kind: "peso" },
  min_baseline_transactions: { label: "Fewest earlier transactions", kind: "count" },
  min_in_amount: { label: "Smallest amount received", kind: "peso" },
  out_share_pct: { label: "Share that leaves again", kind: "percent" },
  within_days: { label: "Within", kind: "days" },
  min_deposits: { label: "Fewest deposits", kind: "count" },
  min_withdrawals: { label: "Fewest withdrawals", kind: "count" },
  min_total: { label: "Smallest total", kind: "peso" },
  min_share_pct: { label: "Smallest share of the loan", kind: "percent" },
  channels: { label: "Channels", kind: "channels" },
  min_branches: { label: "Fewest branches", kind: "count" },
  review_amount: { label: "Review amount", kind: "peso" },
};

/** The kind of a parameter this screen doesn't know yet, guessed from its value, so it still reads sensibly. */
export function amlaParamKind(name: string, value: unknown): AmlaParamKind {
  if (Object.hasOwn(AMLA_PARAM_WORDS, name)) return AMLA_PARAM_WORDS[name].kind;
  if (Array.isArray(value)) return "channels";
  return typeof value === "string" ? "peso" : "count";
}

export function amlaParamLabel(name: string): string {
  return Object.hasOwn(AMLA_PARAM_WORDS, name) ? AMLA_PARAM_WORDS[name].label : "Another setting";
}

const CHANNEL_WORDS: Readonly<Record<string, string>> = Object.fromEntries(PAYMENT_METHOD_OPTIONS.map((o) => [o.value, o.label]));

/** A stored parameter value in words: the server's ₱ figure to two decimals, never worked out. */
export function amlaParamValueWords(kind: AmlaParamKind, value: unknown): string {
  switch (kind) {
    case "peso":
      return formatCurrency(String(value));
    case "channels":
      return (Array.isArray(value) ? value : []).map((c) => CHANNEL_WORDS[String(c)] ?? "Another channel").join(", ") || "—";
    case "percent":
      return `${String(value)}%`;
    case "days":
      return `${String(value)} ${Number(value) === 1 ? "day" : "days"}`;
    case "multiplier":
      return `${String(value)} ${Number(value) === 1 ? "time" : "times"}`;
    default:
      return String(value);
  }
}

/** "Fewest transactions: 2", "Smallest amount received: ₱100,000.00". */
export function amlaParamLine(name: string, value: unknown): string {
  return `${amlaParamLabel(name)}: ${amlaParamValueWords(amlaParamKind(name, value), value)}`;
}

export function amlaRuleTitle(code: string, words?: string): string {
  return `${code} · ${words ?? AMLA_DETECTION_RULE_WORDS[code] ?? "Another rule"}`;
}

/** `RiskScorer::FACTOR_WORDS`, for change lines; the risk rules screen reads the server's own. */
export const AMLA_RISK_FACTOR_WORDS: Readonly<Record<string, string>> = {
  customer_type: "Customer type",
  id_verification: "Identity verification",
  occupation: "Occupation or business",
  source_of_funds: "Source of funds",
  expected_activity: "Expected account activity",
  geography: "Geographic exposure",
  channel: "Transaction channel",
  pep: "Politically exposed person",
  adverse_info: "Adverse information to verify",
};

/** `RiskScorer::VALUE_WORDS`. */
export const AMLA_RISK_VALUE_WORDS: Readonly<Record<string, string>> = {
  member: "Member",
  walk_in: "Walk-in",
  verified: "Verified",
  not_verified: "Not verified",
  expired: "Expired",
  failed: "Could not be verified",
  provided: "Provided",
  missing: "Missing",
  salary: "Salary",
  pension: "Pension",
  savings: "Savings",
  business: "Business",
  remittance: "Remittance",
  other: "Other",
  domestic: "Philippines",
  foreign: "Another country",
  high_risk_country: "A high-risk country",
  no_gcash: "No GCash use",
  gcash: "Uses GCash",
  not_pep: "Not a PEP",
  pep: "PEP",
  pep_family: "Family member of a PEP",
  pep_associate: "Close associate of a PEP",
  none: "None",
  flagged: "Flagged for verification",
};

export function amlaPoints(points: number): string {
  return `${points} ${points === 1 ? "point" : "points"}`;
}

/** "Medium from 20 points, High from 40 points". */
export function amlaThresholdsLine(thresholds: { medium: unknown; high: unknown }): string {
  return `Medium from ${amlaPoints(Number(thresholds.medium))}, High from ${amlaPoints(Number(thresholds.high))}`;
}

/** `RiskRules::FACTOR_VALUES`: each factor's values, in the server's order, so change lines read in a stable order. */
export const AMLA_RISK_FACTOR_VALUES: Readonly<Record<string, readonly string[]>> = {
  customer_type: ["member", "walk_in"],
  id_verification: ["verified", "not_verified", "expired", "failed"],
  occupation: ["provided", "missing"],
  source_of_funds: ["salary", "pension", "savings", "business", "remittance", "other", "missing"],
  expected_activity: ["provided", "missing"],
  geography: ["domestic", "foreign", "high_risk_country", "missing"],
  channel: ["no_gcash", "gcash"],
  pep: ["not_pep", "pep", "pep_family", "pep_associate", "missing"],
  adverse_info: ["none", "flagged"],
};

/** Keys in the server's order first, then any others in name order. */
export function amlaStableKeys(keys: readonly string[], order: readonly string[]): string[] {
  const known = order.filter((key) => keys.includes(key));
  const rest = keys.filter((key) => !order.includes(key)).sort();
  return [...known, ...rest];
}

/** An unordered list (countries, channels) in one stable order, so two lists with the same items compare and read alike. */
export function amlaSortedList(items: readonly unknown[]): string[] {
  return items.map(String).sort();
}
