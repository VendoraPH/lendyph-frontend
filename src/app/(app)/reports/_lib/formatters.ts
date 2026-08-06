import type { ColumnFormat, ReportColumn } from "./types";

/** Shown wherever the API did not send a figure we can display. */
export const DASH = "—";

// Report money is accurate to the centavo. Rounding to whole pesos made a
// column of values disagree with its own total — and the Excel export
// inherited the drift — so every currency figure inside a report carries two
// decimals. This is deliberately report-scoped: `@/lib/format` keeps the
// whole-peso `formatCurrency` the rest of the app renders.
const currencyFmt = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

export function formatCurrency(value: number): string {
  return currencyFmt.format(value);
}

export function formatCount(value: number): string {
  return countFmt.format(value);
}

export function formatPercent(value: number): string {
  return percentFmt.format(value / 100);
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
  column: ReportColumn
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
