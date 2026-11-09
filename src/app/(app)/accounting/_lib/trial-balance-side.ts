import { formatCentavos } from "@/lib/accounting/money";

/**
 * Which side of the trial balance is heavier, read from the server's
 * `difference` (`total_debit - total_credit`): positive means debits are
 * higher, negative means credits are. Null when it balances.
 */
export function heavierSide(difference: number): "debit" | "credit" | null {
  if (difference > 0) return "debit";
  if (difference < 0) return "credit";
  return null;
}

/** The out-of-balance sentence, with the server's difference shown unsigned. */
export function outOfBalanceMessage(difference: number | null | undefined): string | null {
  if (typeof difference !== "number" || !Number.isFinite(difference)) return null;
  const side = heavierSide(difference);
  if (side === null) return null;
  const [heavy, light] = side === "debit" ? ["Debits", "credits"] : ["Credits", "debits"];
  const by = formatCentavos(difference).replace("-", "");
  return `${heavy} are higher than ${light} by ${by}. Something has been posted that should not have been.`;
}
