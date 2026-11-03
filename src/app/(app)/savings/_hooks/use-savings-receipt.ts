"use client";

import { useCallback, useState } from "react";
import { openDocument } from "@/hooks/use-printables";
import { PRINTABLE_TITLES } from "@/lib/page-titles";
import { buildSavingsReceiptDoc } from "@/lib/printables/templates/savings-receipt";
import { savingsTransactionService } from "@/services/savings-transaction.service";
import type { SavingsTransaction } from "@/types/savings";

/**
 * Print a savings receipt. Right after a posting it prints from the response,
 * which already carries the server's balances, so there's no extra read. A
 * reprint passes the id and reads `GET /savings/transactions/{id}`; if that
 * fails the receipt prints as a blank form flagged incomplete.
 */
export function useSavingsReceipt() {
  const [printing, setPrinting] = useState(false);

  const print = useCallback(async (source: SavingsTransaction | number) => {
    setPrinting(true);
    // No try/finally (the React Compiler skips it): openDocument never throws,
    // and a failed read prints the blank form instead.
    await openDocument(PRINTABLE_TITLES.savings_receipt, async (org) => {
      const raw =
        typeof source === "number"
          ? await savingsTransactionService.get(source).catch(() => null)
          : source;
      return buildSavingsReceiptDoc(raw, { org });
    });
    setPrinting(false);
  }, []);

  return { printing, print };
}
