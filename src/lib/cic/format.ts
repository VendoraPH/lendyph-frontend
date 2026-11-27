// CSDF value formatting (CIC data format, 2016):
// - dates are DDMMYYYY;
// - numbers are integers, with no comma and no dot;
// - fields are joined by `|`, and every position is written, empty or not.
import { CIC_LAYOUTS } from "./layouts.generated";
import type { CicFieldDef, CicRawValue, CicRecordType, CicRecordValues } from "./types";

/** True when a raw value carries nothing to report. */
export function isCicEmpty(value: CicRawValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return !Number.isFinite(value);
  return Number.isNaN(value.getTime());
}

/**
 * The calendar parts of a raw date, or null when it is not a real date.
 * Accepts `YYYY-MM-DD` (an ISO timestamp's date part is read as written),
 * an already-formatted `DDMMYYYY`, or a `Date` read by its own local parts.
 */
export function cicDateParts(value: CicRawValue): { y: number; m: number; d: number } | null {
  if (value === null || value === undefined || isCicEmpty(value) || typeof value === "number") return null;
  let y: number, m: number, d: number;
  if (value instanceof Date) {
    y = value.getFullYear();
    m = value.getMonth() + 1;
    d = value.getDate();
  } else {
    const text = value.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    const ddmmyyyy = /^(\d{2})(\d{2})(\d{4})$/.exec(text);
    if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    else if (ddmmyyyy) [d, m, y] = [Number(ddmmyyyy[1]), Number(ddmmyyyy[2]), Number(ddmmyyyy[3])];
    else return null;
  }
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** A sortable `YYYYMMDD` number for comparing two raw dates, or null. */
export function cicDateKey(value: CicRawValue): number | null {
  const p = cicDateParts(value);
  return p ? p.y * 10000 + p.m * 100 + p.d : null;
}

export function formatCicDate(value: CicRawValue): string {
  const p = cicDateParts(value);
  if (!p) return isCicEmpty(value) ? "" : String(value).trim();
  return `${String(p.d).padStart(2, "0")}${String(p.m).padStart(2, "0")}${p.y}`;
}

/** Parses a raw number (Laravel's `decimal:2` sends strings such as "1500.50"). */
export function cicNumber(value: CicRawValue): number | null {
  if (isCicEmpty(value) || value instanceof Date) return null;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Whole pesos, rounded half away from zero, with no separators: 1500.5 → "1501". */
export function formatCicNumber(value: CicRawValue): string {
  const n = cicNumber(value);
  if (n === null) return isCicEmpty(value) ? "" : String(value).trim();
  const rounded = Math.sign(n) * Math.round(Math.abs(n));
  return String(rounded === 0 ? 0 : rounded);
}

/** Text with the delimiter and line breaks removed, so a value can never shift a position. */
export function formatCicText(value: CicRawValue): string {
  if (isCicEmpty(value)) return "";
  const text = value instanceof Date ? formatCicDate(value) : String(value);
  return text.replace(/[|\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function formatCicField(def: CicFieldDef, value: CicRawValue): string {
  if (def.fixed !== undefined) return def.fixed;
  if (def.type === "D") return formatCicDate(value);
  if (def.type === "N") return formatCicNumber(value);
  return formatCicText(value);
}

/**
 * One CSDF line: every field of the record's layout, in order, joined by `|`.
 * Position 2 is always the provider code.
 */
export function formatCicRecord(
  type: CicRecordType,
  values: CicRecordValues,
  providerCode: string,
): string {
  return CIC_LAYOUTS[type]
    .map((def, i) => formatCicField(def, i === 1 ? providerCode : values[def.id]))
    .join("|");
}
