// Shared formatters used across the app.
// Locale: en-PH, Currency: PHP. Keep formatting consistent everywhere.

import { env } from "@/config/env";

const pesoFmt = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Every peso amount the app shows: always two decimals, so ₱1,500 reads
 * "₱1,500.00" and ₱10.50 reads "₱10.50".
 *
 * Money is held to the centavo, and a figure rounded to whole pesos states a
 * different amount from the one the server holds — a fee rule of
 * `amount > 9999.50` shown as "₱10,000" advertises a threshold fifty centavos
 * above the one that fires. The only figures that may drop decimals are the
 * deliberately abbreviated dashboard tiles ("₱130K").
 *
 * Accepts the strings Laravel's `decimal:2` cast sends; anything absent or
 * unparseable renders as ₱0.00, never NaN.
 */
export function formatCurrency(
  amount: number | string | undefined | null,
): string {
  return pesoFmt.format(parseFloat(String(amount ?? 0)) || 0);
}

/**
 * Same output as `formatCurrency`. Kept for the call sites that reached for it
 * when `formatCurrency` still rounded to whole pesos.
 */
export function formatCurrencyExact(
  amount: number | string | undefined | null,
): string {
  return formatCurrency(amount);
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

// ---------------------------------------------------------------------------
// Dates and times are shown in the app's time zone (Asia/Manila), whatever the
// computer is set to (round fz). On one set to New York, every date-only value
// read a day early; on one east of Manila, evening timestamps read a day late.
// ---------------------------------------------------------------------------

/** The zone every date and time is shown in. */
const APP_TIME_ZONE = env.business.timezone || "Asia/Manila";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const NO_ZONE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

interface Shown {
  date: Date;
  timeZone: string;
}

/**
 * What a value shows, and in which zone.
 *
 * A date alone, or a server time with no zone, is already a reading in the
 * app's zone (the server's own Manila time). It is held at that reading in UTC
 * and shown in UTC, so no computer can move it. A timestamp with a zone, or a
 * `Date`, is an instant, shown in the app's zone.
 */
function shown(value: string | Date): Shown {
  if (value instanceof Date) return { date: value, timeZone: APP_TIME_ZONE };
  const text = value.trim();
  if (DATE_ONLY.test(text)) return { date: new Date(`${text}T00:00:00Z`), timeZone: "UTC" };
  if (NO_ZONE.test(text)) return { date: new Date(`${text.replace(" ", "T")}Z`), timeZone: "UTC" };
  return { date: new Date(text), timeZone: APP_TIME_ZONE };
}

function formatShown(value: string | Date, options: Intl.DateTimeFormatOptions): string {
  const { date, timeZone } = shown(value);
  return date.toLocaleDateString("en-PH", { ...options, timeZone });
}

export function formatDate(dateStr: string | Date): string {
  return formatShown(dateStr, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(dateStr: string | Date): string {
  return formatShown(dateStr, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * A calendar date held as a `Date` at the computer's own midnight: a date
 * picker's value, or `parseApiDate`'s. Its own year, month and day are the
 * date, so they are read as they are (the same parts `formatDateISO` sends).
 * Shown in Manila's zone, a midnight in Auckland would read the day before.
 */
export function formatDateObj(date: Date): string {
  const calendarDay = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return calendarDay.toLocaleDateString("en-PH", {
    timeZone: "UTC",
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

/** `YYYY-MM-DD` in the app's zone (`en-CA` writes dates in that order). */
const appDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Today's calendar date as `YYYY-MM-DD`, in the app's zone (Manila), whatever
 * the computer is set to.
 *
 * The one correct way to answer "what is today?" — `new Date().toISOString()`
 * is not it. Between 00:00 and 07:59 in Manila (UTC+8) the UTC instant still
 * falls on the previous day, so a cashier opening the payment form at 07:00
 * posted the receipt against yesterday; a computer set to New York was a day
 * behind until noon. Reach for this for defaults, filters and export filenames;
 * use `formatDateISO` when you already hold a picked `Date`.
 */
export function todayISO(): string {
  return appDayFmt.format(new Date());
}

/**
 * Manila's today as a date picker holds a date: a `Date` at the computer's own
 * midnight, so `formatDateISO` and `formatDateObj` read it back as that day.
 * Use it for a picker's default instead of `new Date()`.
 */
export function todayDate(): Date {
  return calendarDate(new Date());
}

/**
 * A server date as the calendar day it names in the app's zone, held as a date
 * picker holds a day: a `Date` at the computer's own midnight, for
 * `formatDateObj` and `formatDateISO`. A date alone, or a server time with no
 * zone, keeps its own day. A timestamp with a zone takes Manila's day.
 *
 * `new Date("2026-11-09")` is midnight UTC, which a computer west of UTC
 * holds as the evening of the 8th, so a due date read a day early there.
 */
export function calendarDate(value: string | Date): Date {
  let day: string;
  if (typeof value === "string" && (DATE_ONLY.test(value.trim()) || NO_ZONE.test(value.trim()))) {
    day = value.trim().slice(0, 10);
  } else {
    const instant = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(instant.getTime())) return new Date(Number.NaN);
    day = appDayFmt.format(instant);
  }
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
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
  return formatShown(date, { year: "numeric", month: "long", day: "numeric" });
}

/**
 * "Friday, August 28, 2026" — long form with the weekday.
 *
 * Only worth it where the day of the week is the point, e.g. a dashboard
 * panel reporting on *today's* collections.
 */
export function formatDateFull(date: string | Date): string {
  return formatShown(date, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/**
 * "1:30 PM" — the time on its own, for when the date is rendered beside it.
 *
 * `formatDateTime` gives you both in one string; this is the split form the
 * audit trail uses, where date and time sit in separate columns.
 */
export function formatTime(date: string | Date): string {
  const { date: instant, timeZone } = shown(date);
  return instant.toLocaleTimeString("en-PH", { timeZone, hour: "numeric", minute: "2-digit", hour12: true });
}
