// Cash entries get their reference number from the server, one series per
// kind of record: [PREFIX]-[super admin user id]-[year]-[sequence], e.g.
// CSH-1002325-2026-0001 for share capital and TD-0012-2026-0001 for time
// deposits. The server assigns it when the record saves, so a number is never
// used twice or skipped, and each entry of a bulk batch gets its own. Before
// that the field shows the server's preview of the next one, read-only.
// Dependency-free, so it runs under `tsx --test`.

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
 * not shown. `null` means the field is the usual typed one. `entries` above
 * 1 is a bulk batch: the server numbers each of its entries in turn, starting
 * with the preview.
 */
export function seriesAutoReference(
  series: CashReferenceSeries,
  enabled: boolean,
  method: string,
  preview: string | null,
  entries = 1,
): AutoReference | null {
  if (!enabled || method !== "cash") return null;
  const value = preview !== null && cashReferencePattern(series).test(preview) ? preview : "";
  const plural = series.noun === "entry" ? "entries" : `${series.noun}s`;
  if (entries > 1) {
    return {
      value,
      hint:
        value === ""
          ? `Each cash ${series.noun} gets its own ${series.prefix} reference number when saved.`
          : `Each ${series.noun} gets its own ${series.prefix} reference number when saved, starting with this one.`,
    };
  }
  return {
    value,
    hint:
      value === ""
        ? `Cash ${plural} get the next ${series.prefix} reference number when saved.`
        : `The next ${series.prefix} reference number. It is confirmed when the ${series.noun} saves.`,
  };
}

/** The share capital series, for the pledge entry forms (`entries` > 1 for a bulk batch). */
export function cashAutoReference(
  enabled: boolean,
  method: RecordPaymentMethod,
  preview: string | null,
  entries = 1,
): AutoReference | null {
  return seriesAutoReference(SHARE_CAPITAL_CASH_SERIES, enabled, method, preview, entries);
}

/**
 * The numbers a save got back, for its success message: the one number, or a
 * batch's first and last ("CSH-0001-2026-0004 to CSH-0001-2026-0006"). Empty
 * when the server sent none.
 */
export function savedReferencesText(numbers: readonly (string | null | undefined)[]): string {
  const saved = numbers.filter((number): number is string => typeof number === "string" && number !== "");
  if (saved.length === 0) return "";
  const first = saved[0];
  const last = saved[saved.length - 1];
  return first === last ? first : `${first} to ${last}`;
}
