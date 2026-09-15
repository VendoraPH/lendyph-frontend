/**
 * Receivable aging.
 *
 * Splits outstanding balances by how long they have been overdue, which is
 * both what SEC lending-company reporting expects and the input a provisioning
 * policy needs — the older a receivable, the more of it a lender should expect
 * to lose.
 *
 * Derived entirely from due dates and balances, never stored, so it cannot
 * drift from the loan records the way a nightly-snapshot table would.
 */

import type { Aging, AgingBucket, AgingRow } from "@/types/accounting";

export type { Aging };

/** Buckets in report order, youngest first. */
export const AGING_BUCKETS = [
  "current",
  "1_30",
  "31_60",
  "61_90",
  "91_120",
  "over_120",
] as const;

const LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "1_30": "1–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  "91_120": "91–120 days",
  over_120: "Over 120 days",
};

export function agingBucketLabel(bucket: AgingBucket): string {
  return LABELS[bucket];
}

/**
 * Which bucket a balance falls into.
 *
 * Upper bounds are inclusive — 30 days is the last day of "1–30", 31 the first
 * of "31–60" — so no day belongs to two buckets or to none. Anything not yet
 * due is `current`; being early is not a degree of lateness.
 */
export function bucketForDaysPastDue(days: number): AgingBucket {
  if (days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  if (days <= 120) return "91_120";
  return "over_120";
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole days a due date is behind the reporting date, floored at zero.
 *
 * Both dates are read as UTC midnight rather than local time. A loan is a day
 * late or it is not; letting a local timezone offset put 31 days at 30.96 and
 * round it into the wrong bucket would be an aging report that changes
 * depending on who opens it.
 *
 * An unparseable date returns 0 — reporting a missing due date as "not overdue"
 * understates rather than invents a delinquency, and the missing date is a data
 * problem to surface elsewhere, not something to guess at here.
 */
export function daysPastDue(dueDate: string, asOf: string): number {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return 0;
  const days = Math.floor((now - due) / MS_PER_DAY);
  return days > 0 ? days : 0;
}

/** One outstanding balance with the date it fell due. */
export interface AgingInput {
  /** Centavos still outstanding. */
  amount: number;
  due_date: string;
}

/**
 * Ages a set of receivables.
 *
 * Every bucket is returned even when empty, so the table has a stable shape
 * and a column does not disappear the month nothing lands in it. Zero-balance
 * rows are skipped entirely — a fully settled loan is not a receivable, and
 * counting it would inflate the count column with finished business.
 */
export function buildAging(items: AgingInput[], asOf: string): Aging {
  const totals = new Map<AgingBucket, { amount: number; count: number }>(
    AGING_BUCKETS.map((bucket) => [bucket, { amount: 0, count: 0 }])
  );

  for (const item of items) {
    if (item.amount <= 0) continue;
    const bucket = bucketForDaysPastDue(daysPastDue(item.due_date, asOf));
    const slot = totals.get(bucket)!;
    slot.amount += item.amount;
    slot.count += 1;
  }

  const rows: AgingRow[] = AGING_BUCKETS.map((bucket) => ({
    bucket,
    ...totals.get(bucket)!,
  }));

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const past_due_total = total - (totals.get("current")?.amount ?? 0);

  return { as_of: asOf, rows, total, past_due_total };
}
