import type { ColumnFormat, ReportColumn } from "./types";

const currencyFmt = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFmt = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 2,
});

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

export function formatCurrency(value: number): string {
  return currencyFmt.format(Math.round(value));
}

export function formatValue(value: unknown, format?: ColumnFormat): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (format) {
    case "currency": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n)) return String(value);
      return currencyFmt.format(Math.round(n));
    }
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n)) return String(value);
      return numberFmt.format(n);
    }
    case "percent": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n)) return String(value);
      // Treat values >1 as whole-number percents (e.g. 85 → 85%).
      return percentFmt.format(n > 1 ? n / 100 : n);
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
