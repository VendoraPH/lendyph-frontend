// Cash entries get their reference number from the server, one series per
// kind of record: [PREFIX]-[super admin user id]-[year]-[sequence], e.g.
// CSH-1002325-2026-0001 for share capital and TD-0012-2026-0001 for time
// deposits. The server assigns it when the record saves, so a number is never
// used twice or skipped. Before that the field shows the server's preview of
// the next one, read-only. Dependency-free, so it runs under `tsx --test`.

import type { RecordPaymentMethod } from "@/constants/payment-methods";

/** One numbering series: its prefix and what one record of it is called. */
export interface CashReferenceSeries {
  prefix: string;
  /** "entry", "placement": used in the field's hint. */
  noun: string;
}

/** Cash share capital entries. */
export const SHARE_CAPITAL_CASH_SERIES: CashReferenceSeries = { prefix: "CSH", noun: "entry" };
/** Cash time deposit placements. */
export const TIME_DEPOSIT_CASH_SERIES: CashReferenceSeries = { prefix: "TD", noun: "placement" };

/** `[PREFIX]-[digits]-[YYYY]-[at least four digits]`. */
export function cashReferencePattern(series: CashReferenceSeries): RegExp {
  return new RegExp(String.raw`^${series.prefix}-\d+-\d{4}-\d{4,}$`);
}

export const CASH_REFERENCE_PATTERN = cashReferencePattern(SHARE_CAPITAL_CASH_SERIES);

export const CASH_REFERENCE_PLACEHOLDER = "Assigned when saved";

export interface AutoReference {
  /** The preview, or "" while there is none to show. */
  value: string;
  hint: string;
}

/**
 * What the reference field shows when the server numbers it: only for Cash,
 * and only on a build that has the feature. A preview outside the series is
 * not shown. `null` means the field is the usual typed one.
 */
export function seriesAutoReference(
  series: CashReferenceSeries,
  enabled: boolean,
  method: string,
  preview: string | null,
): AutoReference | null {
  if (!enabled || method !== "cash") return null;
  const value = preview !== null && cashReferencePattern(series).test(preview) ? preview : "";
  return {
    value,
    hint:
      value === ""
        ? `Cash ${series.noun === "entry" ? "entries" : `${series.noun}s`} get the next ${series.prefix} reference number when saved.`
        : `The next ${series.prefix} reference number. It is confirmed when the ${series.noun} saves.`,
  };
}

/** The share capital series, for the pledge entry forms. */
export function cashAutoReference(
  enabled: boolean,
  method: RecordPaymentMethod,
  preview: string | null,
): AutoReference | null {
  return seriesAutoReference(SHARE_CAPITAL_CASH_SERIES, enabled, method, preview);
}
