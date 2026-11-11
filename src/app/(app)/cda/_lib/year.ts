import type { CdaPeriod } from "@/types/cda";

/**
 * The reporting year a CDA screen shows: the one the user picked when it is
 * still an open period, else the newest period (the server lists them newest
 * first), else none.
 */
export function resolveYear(preferred: number | null, periods: readonly Pick<CdaPeriod, "year">[]): number | null {
  if (preferred !== null && periods.some((p) => p.year === preferred)) return preferred;
  return periods[0]?.year ?? null;
}

/** A typed year to open, or null: four digits from 2000 to 2999, as the server takes them. */
export function parseYear(raw: string): number | null {
  const text = raw.trim();
  if (!/^2\d{3}$/.test(text)) return null;
  return Number(text);
}
