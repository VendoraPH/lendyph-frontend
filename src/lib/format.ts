// Shared formatters used across the app.
// Locale: en-PH, Currency: PHP. Keep formatting consistent everywhere.

export function formatCurrency(
  amount: number | string | undefined | null,
): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(parseFloat(String(amount ?? 0)) || 0));
}

/**
 * Format an interest/percentage rate for display, trimming trailing zeros.
 * The API returns rates like "3.0000"; this yields "3", "3.5", "12.75".
 * Returns the bare number — callers append the "%" sign.
 */
export function formatRate(rate: number | string | undefined | null): string {
  const n = parseFloat(String(rate ?? 0)) || 0;
  return String(parseFloat(n.toFixed(4)));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateObj(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Serialise a Date to `YYYY-MM-DD` using its *local* calendar parts.
 *
 * `toISOString()` converts to UTC first, so a Date built at local midnight in
 * Manila (UTC+8) serialised to the previous day — every date filter and every
 * posted date landed one day early. Build the string from local Y/M/D so the
 * value is exactly the calendar date the user picked.
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Today's calendar date as `YYYY-MM-DD`, in the user's own timezone.
 *
 * The one correct way to answer "what is today?" — `new Date().toISOString()`
 * is not it. Between 00:00 and 07:59 in Manila (UTC+8) the UTC instant still
 * falls on the previous day, so a cashier opening the payment form at 07:00
 * posted the receipt against yesterday. Reach for this for defaults, filters
 * and export filenames; use `formatDateISO` when you already hold a `Date`.
 */
export function todayISO(): string {
  return formatDateISO(new Date());
}

// ---------------------------------------------------------------------------
// Long / time forms
// ---------------------------------------------------------------------------
//
// These take `string | Date` rather than following the existing
// `formatDate(string)` + `formatDateObj(Date)` split. That split is why there
// were three separate copies of the same short-date formatter in the loan
// detail page alone — every caller holding the wrong one of the two types
// wrote its own instead of converting. One entry point per format, and the
// conversion happens here.

/** `new Date(string)` unless it already is one. */
function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * "August 28, 2026" — the long form.
 *
 * For headers and review screens where a date is read rather than scanned:
 * the registration detail page, printable headings. Use `formatDate` for
 * tables, where "Aug 28, 2026" scans better in a column.
 *
 * Note `en-US` and `en-PH` produce identical output for this pattern (and for
 * every other pattern in this file), so call sites that reached for `en-US` by
 * habit can move here with no visual change at all.
 */
export function formatDateLong(date: string | Date): string {
  return toDate(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * "Friday, August 28, 2026" — long form with the weekday.
 *
 * Only worth it where the day of the week is the point, e.g. a dashboard
 * panel reporting on *today's* collections.
 */
export function formatDateFull(date: string | Date): string {
  return toDate(date).toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * "1:30 PM" — the time on its own, for when the date is rendered beside it.
 *
 * `formatDateTime` gives you both in one string; this is the split form the
 * audit trail uses, where date and time sit in separate columns.
 */
export function formatTime(date: string | Date): string {
  return toDate(date).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
