import { shareCapitalService } from "@/services";
import type { ShareCapitalLedgerEntry } from "@/types";

/**
 * Computes the borrower's current share capital balance by summing
 * credits and subtracting debits across their ledger entries.
 *
 * Returns 0 if the request fails — caller can decide whether to surface
 * an error UI separately.
 */
export async function getShareCapitalBalance(
  borrowerId: number,
): Promise<number> {
  try {
    const res = await shareCapitalService.ledgerList({
      borrower_id: borrowerId,
      per_page: 9999,
    });
    const items =
      (res as { data?: ShareCapitalLedgerEntry[] }).data ??
      (res as unknown as ShareCapitalLedgerEntry[]);
    if (!Array.isArray(items)) return 0;
    let credits = 0;
    let debits = 0;
    for (const e of items) {
      // Defensive coercion — bad/missing amounts shouldn't poison the running
      // total with NaN (which would propagate to "-₱NaN" in the UI).
      const amount = Number(e.amount);
      if (!Number.isFinite(amount)) continue;
      if (e.type === "credit") credits += amount;
      else debits += amount;
    }
    const balance = credits - debits;
    return Number.isFinite(balance) ? balance : 0;
  } catch {
    return 0;
  }
}
