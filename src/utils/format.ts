import { format, formatDistanceToNow } from "date-fns";
import currency from "currency.js";

export const PHP = (value: number) =>
  currency(value, { symbol: "₱", precision: 2 });

export const formatCurrency = (amount: number): string =>
  PHP(amount).format();

export const formatDate = (date: string | Date, pattern = "MMM dd, yyyy"): string =>
  format(new Date(date), pattern);

export const formatDateTime = (date: string | Date): string =>
  format(new Date(date), "MMM dd, yyyy hh:mm a");

export const formatRelativeDate = (date: string | Date): string =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

export const formatPercentage = (value: number): string =>
  `${value.toFixed(2)}%`;
