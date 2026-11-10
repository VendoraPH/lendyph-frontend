import type { MaturityInstruction, TimeDeposit, TimeDepositStatus } from "@/types";

/**
 * Time deposit words and the date rules that decide which actions a screen
 * offers. Every figure (interest, tax, maturity amount, payout) is the
 * server's: the placement form shows `POST /savings/time-deposits/quote`.
 */

export const TD_STATUS_LABELS: Record<TimeDepositStatus, string> = {
  active: "Active",
  matured: "Matured",
  withdrawn: "Withdrawn",
  rolled_over: "Rolled over",
  preterminated: "Pre-terminated",
};

export const MATURITY_INSTRUCTION_LABELS: Record<MaturityInstruction, string> = {
  payout: "Pay out principal and interest",
  rollover_principal: "Roll over principal, pay out interest",
  rollover_all: "Roll over principal and interest",
};

export const MATURITY_INSTRUCTION_OPTIONS = (
  Object.keys(MATURITY_INSTRUCTION_LABELS) as MaturityInstruction[]
).map((value) => ({ value, label: MATURITY_INSTRUCTION_LABELS[value] }));

/** Whole days from `fromISO` to `toISO` (negative when `toISO` is earlier). */
export function daysBetween(fromISO: string, toISO: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(toISO) - ms(fromISO)) / 86_400_000);
}

/** A running placement whose maturity date has come; the server may not have flipped it to `matured` yet. */
export function canSettle(td: Pick<TimeDeposit, "status" | "maturity_date">, today: string): boolean {
  if (td.status === "matured") return true;
  return td.status === "active" && daysBetween(today, td.maturity_date) <= 0;
}

/** Only a running placement before its maturity date can be broken early. */
export function canPreterminate(td: Pick<TimeDeposit, "status" | "maturity_date">, today: string): boolean {
  return td.status === "active" && daysBetween(today, td.maturity_date) > 0;
}

/** "Matures in 12 days", "Matures today", "Due 3 days ago", or null once settled. */
export function maturityHint(td: Pick<TimeDeposit, "status" | "maturity_date">, today: string): string | null {
  if (td.status !== "active" && td.status !== "matured") return null;
  const days = daysBetween(today, td.maturity_date);
  if (days > 0) return `Matures in ${days} day${days === 1 ? "" : "s"}`;
  if (days === 0) return "Matures today";
  return `Due ${-days} day${days === -1 ? "" : "s"} ago`;
}

/** "30, 90,180" → [30, 90, 180]; null when blank or any entry is not a whole number of days ≥ 1. */
export function parseTermOptions(raw: string): number[] | null {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0 || parts.some((p) => !/^\d+$/.test(p) || Number(p) < 1)) return null;
  return [...new Set(parts.map(Number))].sort((a, b) => a - b);
}

/** "90 days", "1 day". */
export function termLabel(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** Status tabs for placements, with counts from `meta.stats`. */
export function tdStatusTabs(stats: Partial<Record<TimeDepositStatus, number>> | undefined) {
  const order: TimeDepositStatus[] = ["active", "matured", "withdrawn", "rolled_over", "preterminated"];
  return [
    { value: "all", label: "All", count: null as number | null },
    ...order.map((s) => ({ value: s, label: TD_STATUS_LABELS[s], count: stats?.[s] ?? 0 })),
  ];
}
