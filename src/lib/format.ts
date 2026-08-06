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
