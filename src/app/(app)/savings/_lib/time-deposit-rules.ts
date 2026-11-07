import type {
  MaturityInstruction,
  SavingsProduct,
  TimeDeposit,
  TimeDepositStatus,
} from "@/types";
import { toAmount } from "./savings-rules";

/**
 * Time deposit rules shared by the screens. The server computes every figure
 * that is stored; these only let staff see the shape of a placement before
 * they submit it, and decide which actions to offer.
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

/**
 * Day-count basis of the estimate. Many Philippine institutions compute
 * deposit interest on actual/360; the server's basis is the one that counts,
 * and the form labels its figures as an estimate.
 */
export const ESTIMATE_DAY_BASIS = 360;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** `YYYY-MM-DD` plus `days`, as `YYYY-MM-DD`. Pure calendar arithmetic, so no timezone can shift it. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from `fromISO` to `toISO` (negative when `toISO` is earlier). */
export function daysBetween(fromISO: string, toISO: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(toISO) - ms(fromISO)) / 86_400_000);
}

export interface PlacementEstimate {
  maturityDate: string;
  grossInterest: number;
  withholdingTax: number;
  netInterest: number;
  maturityAmount: number;
}

/** What a placement should earn over its full term, on `ESTIMATE_DAY_BASIS`. */
export function estimatePlacement(
  principal: number,
  annualRatePct: number,
  termDays: number,
  withholdingPct: number,
  placementISO: string,
): PlacementEstimate {
  const grossInterest = round2((principal * (annualRatePct / 100) * termDays) / ESTIMATE_DAY_BASIS);
  const withholdingTax = round2(grossInterest * (withholdingPct / 100));
  const netInterest = round2(grossInterest - withholdingTax);
  return {
    maturityDate: addDaysISO(placementISO, termDays),
    grossInterest,
    withholdingTax,
    netInterest,
    maturityAmount: round2(principal + netInterest),
  };
}

/** Why a placement amount is refused, or null. */
export function placementProblem(
  principal: number | null,
  product: Pick<SavingsProduct, "minimum_opening_balance"> | null,
): string | null {
  if (principal === null) return "Enter the amount to place.";
  const min = toAmount(product?.minimum_opening_balance);
  if (product && principal < min) return `This product needs at least ${min.toFixed(2)} to place.`;
  return null;
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
export function tdStatusTabs(stats: Record<string, number> | undefined) {
  const order: TimeDepositStatus[] = ["active", "matured", "withdrawn", "rolled_over", "preterminated"];
  const counts = order.map((s) => stats?.[s] ?? 0);
  return [
    { value: "all", label: "All", count: counts.reduce((a, b) => a + b, 0) },
    ...order.map((s, i) => ({ value: s, label: TD_STATUS_LABELS[s], count: counts[i] })),
  ];
}
