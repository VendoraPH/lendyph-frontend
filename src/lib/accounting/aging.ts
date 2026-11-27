/**
 * Receivable aging: the bucket names and their labels.
 *
 * The aging itself (amounts, counts, shares and the past-due total) is the
 * server's, from `GET /accounting/loans/aging` and the Loan Accounting summary.
 * The browser only names the buckets.
 */

import type { Aging, AgingBucket } from "@/types/accounting";

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
