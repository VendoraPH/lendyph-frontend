import { formatDistanceToNow } from "date-fns";
import currency from "currency.js";

export const PHP = (value: number) =>
  currency(value, { symbol: "₱", precision: 2 });

export const formatCurrency = (amount: number): string =>
  PHP(amount).format();

/** Dates and times read in Manila time; the shared helpers in `src/lib/format.ts` do the work. */
export { formatDate, formatDateTime } from "@/lib/format";

export const formatRelativeDate = (date: string | Date): string =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

export const formatPercentage = (value: number): string =>
  `${value.toFixed(2)}%`;
