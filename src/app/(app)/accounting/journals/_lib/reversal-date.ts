/**
 * The reverse dialog's date. A reversal can't be dated before the entry it
 * reverses, so the dialog refuses that before sending. Dates are ISO
 * (YYYY-MM-DD) strings, which compare in calendar order.
 */
import { formatDate } from "@/lib/format";

/** Why the chosen reversal date can't be used; null when it can. */
export function reversalDateError(date: string, entryDate: string): string | null {
  if (date === "") return "Choose the reversal date.";
  if (date < entryDate) {
    return `The reversal date can't be before the entry's own date, ${formatDate(entryDate)}.`;
  }
  return null;
}

/** Today, or the entry's own date when that is later. */
export function defaultReversalDate(entryDate: string, today: string): string {
  return entryDate > today ? entryDate : today;
}
