/**
 * Report and printable formatters — en-PH, accurate to the centavo.
 *
 * Lives in `src/lib/` rather than under the reports route because
 * `src/lib/printables/**` reads it too, and a module in `src/lib/` must not
 * import from an app route folder. Sharing it is the point, not an accident:
 * a peso prints the same way on a receipt as it does in a report, and the
 * hand-written documents drifted precisely because they each carried their own
 * `fmt()`.
 *
 * Money goes through `src/lib/format.ts`'s `formatCurrency`, so a report, a
 * printable and a screen all show the same two decimals.
 */

import { formatCurrency as formatPeso } from "./format";

/** Shown wherever the API did not send a figure we can display. */
export const DASH = "—";

/**
 * How a value is rendered. Report columns and print columns share this
 * vocabulary so one `formatValue` serves both.
 *
 * `rate` is an interest rate (a loan's own, or the server's average of them),
 * shown to every place it has; `percent` is a share or ratio, to one decimal.
 */
export type ColumnFormat =
  | "text"
  | "currency"
  | "number"
  | "percent"
  | "rate"
  | "date"
  | "datetime";

/**
 * The part of a column `formatCell` actually reads.
 *
 * `ReportColumn` extends this rather than redeclaring the three fields, so the
 * formatter's contract has one definition while the presentation fields
 * (`header`, `width`, `align`) stay with the report document model.
 */
export interface FormattableColumn {
  key: string;
  format?: ColumnFormat;
  formatter?: (value: unknown, row: Record<string, unknown>) => string;
}

const numberFmt = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 2,
});

const countFmt = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 0,
});

// API contract: percentages come back as whole percents (12.5 means 12.5%),
// so they are always divided by 100 before Intl re-multiplies them. Never
// guess from magnitude — a genuine 0.8% used to render as 80%.
const percentFmt = new Intl.NumberFormat("en-PH", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// An interest rate keeps every place of its `decimal(8,4)` column. The single
// decimal above is right for a share or ratio and wrong here: it printed a
// 1.25%-a-month loan as 1.3%. The minimum of one keeps 3 printing as "3.0%".
const rateFmt = new Intl.NumberFormat("en-PH", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 4,
});

const dateFmt = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Coerce an API value to a finite number, or null when it is not one. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// Report money is accurate to the centavo. Rounding to whole pesos made a
// column of values disagree with its own total — and the Excel export
// inherited the drift — so every currency figure inside a report carries two
// decimals, exactly as every other screen does.
export function formatCurrency(value: number): string {
  return formatPeso(value);
}

export function formatCount(value: number): string {
  return countFmt.format(value);
}

export function formatPercent(value: number): string {
  return percentFmt.format(value / 100);
}

/** An interest rate, exact to the four places a rate is stored to. */
export function formatRatePercent(value: number): string {
  return rateFmt.format(value / 100);
}

export function currencyOrDash(value: unknown): string {
  const n = toNumber(value);
  return n === null ? DASH : formatCurrency(n);
}

export function countOrDash(value: unknown): string {
  const n = toNumber(value);
  return n === null ? DASH : formatCount(n);
}

export function percentOrDash(value: unknown): string {
  const n = toNumber(value);
  return n === null ? DASH : formatPercent(n);
}

export function rateOrDash(value: unknown): string {
  const n = toNumber(value);
  return n === null ? DASH : formatRatePercent(n);
}

export function formatValue(value: unknown, format?: ColumnFormat): string {
  if (value === null || value === undefined || value === "") return DASH;
  switch (format) {
    case "currency": {
      const n = toNumber(value);
      if (n === null) return String(value);
      return formatCurrency(n);
    }
    case "number": {
      const n = toNumber(value);
      if (n === null) return String(value);
      return numberFmt.format(n);
    }
    case "percent": {
      const n = toNumber(value);
      if (n === null) return String(value);
      return formatPercent(n);
    }
    case "rate": {
      const n = toNumber(value);
      if (n === null) return String(value);
      return formatRatePercent(n);
    }
    case "date": {
      const d = new Date(value as string | number | Date);
      if (Number.isNaN(d.getTime())) return String(value);
      return dateFmt.format(d);
    }
    case "datetime": {
      const d = new Date(value as string | number | Date);
      if (Number.isNaN(d.getTime())) return String(value);
      return dateTimeFmt.format(d);
    }
    default:
      return String(value);
  }
}

export function formatCell(
  row: Record<string, unknown>,
  column: FormattableColumn
): string {
  if (column.formatter) {
    return column.formatter(row[column.key], row);
  }
  return formatValue(row[column.key], column.format);
}

export function formatDateRange(from: string, to: string): string {
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate && toDate) {
    if (fromDate.getTime() === toDate.getTime()) {
      return dateFmt.format(fromDate);
    }
    return `${dateFmt.format(fromDate)} – ${dateFmt.format(toDate)}`;
  }
  if (fromDate) return `From ${dateFmt.format(fromDate)}`;
  if (toDate) return `Up to ${dateFmt.format(toDate)}`;
  return "All time";
}

export function formatGeneratedAt(date = new Date()): string {
  return dateTimeFmt.format(date);
}
