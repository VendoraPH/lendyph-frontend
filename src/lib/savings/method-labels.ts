import type { SavingsMethod } from "@/types";

/**
 * How money came in or went out of a savings account, in words. Shared by the
 * savings screens and the printables, so a receipt and the ledger read alike.
 */
export const METHOD_LABELS: Record<SavingsMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  gcash: "GCash",
  maya: "Maya",
  savings: "Savings account",
};
