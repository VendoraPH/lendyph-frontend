// Cash share capital entries get their reference number from the server:
// CSH-[super admin user id]-[year]-[sequence], e.g. CSH-1002325-2026-0001.
// The server assigns it when the entry saves, so a number is never used twice
// or skipped. Before that the field shows the server's preview of the next one,
// read-only. Dependency-free, so it runs under `tsx --test`.

import type { RecordPaymentMethod } from "@/constants/payment-methods";

export const CASH_REFERENCE_PATTERN = /^CSH-\d+-\d{4}-\d{4,}$/;

export const CASH_REFERENCE_PLACEHOLDER = "Assigned when saved";

export interface AutoReference {
  /** The preview, or "" while there is none to show. */
  value: string;
  hint: string;
}

/**
 * What the Reference Number field shows when the server numbers it: only for
 * Cash, and only on a build that has the feature. A preview that isn't a CSH
 * number is not shown. `null` means the field is the usual typed one.
 */
export function cashAutoReference(
  enabled: boolean,
  method: RecordPaymentMethod,
  preview: string | null,
): AutoReference | null {
  if (!enabled || method !== "cash") return null;
  const value = preview !== null && CASH_REFERENCE_PATTERN.test(preview) ? preview : "";
  return {
    value,
    hint:
      value === ""
        ? "Cash entries get the next CSH reference number when saved."
        : "The next CSH reference number. It is confirmed when the entry saves.",
  };
}
