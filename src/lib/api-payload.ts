import { toNumber } from "./report-format";

/**
 * Defensive readers for whatever the API actually sent.
 *
 * One copy of these lived in `reports/_lib/report-builders.ts` and a slightly
 * better one in `printables/templates/shared.ts`; this is the better set,
 * promoted so both read the payload identically. Every rule is the same:
 * first key wins, the aliases behind it are what older responses used, and
 * nothing throws on a shape we did not expect — a missing block reads as
 * absent, not as zero.
 */

/** A plain object, or null. Arrays are not records. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * The rows in a payload, however this endpoint chose to wrap them.
 *
 * Non-object members are dropped rather than carried: a stray `null` or a bare
 * id in a list would otherwise reach the renderer as a row of dashes, which
 * reads as broken data on a document someone signs.
 */
export function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((v) => v && typeof v === "object") as Record<
      string,
      unknown
    >[];
  }
  const obj = asRecord(value);
  if (!obj) return [];
  for (const key of ["data", "rows", "items", "results", "entries"]) {
    if (Array.isArray(obj[key])) {
      return (obj[key] as unknown[]).filter(
        (v) => v && typeof v === "object"
      ) as Record<string, unknown>[];
    }
  }
  return [];
}

/**
 * First key that holds something, or null.
 *
 * `""` counts as nothing: the API sends an empty string for "not recorded" on
 * plenty of nullable columns, and a blank is not a value worth printing.
 */
export function pick<T = unknown>(
  obj: Record<string, unknown> | null | undefined,
  keys: string[]
): T | null {
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") {
      return value as T;
    }
  }
  return null;
}

/** `pick`, coerced to a finite number. */
export function pickNumber(
  obj: Record<string, unknown> | null | undefined,
  keys: string[]
): number | null {
  return toNumber(pick(obj, keys));
}

/** Total one column across rows, counting anything unreadable as zero. */
export function sum(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((acc, row) => acc + (toNumber(row[key]) ?? 0), 0);
}
