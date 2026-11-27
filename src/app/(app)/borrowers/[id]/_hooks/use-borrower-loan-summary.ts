"use client";

import { useEffect, useState } from "react";
import { borrowerService } from "@/services/borrower.service";
import type { BorrowerLoanSummary, Loan } from "@/types";

/**
 * GET /borrowers/{id}/loan-summary, read once for the page and shared by the
 * Overview and Payments tabs so both show the same server figures. Re-read
 * whenever the page reloads the member's loans. Null while loading or after a
 * failure, so each figure shows a dash rather than a sum of the loans.
 */
export function useBorrowerLoanSummary(
  borrowerId: number | undefined,
  loans: Loan[],
): BorrowerLoanSummary | null {
  const [summary, setSummary] = useState<BorrowerLoanSummary | null>(null);
  useEffect(() => {
    if (borrowerId === undefined) return;
    let cancelled = false;
    borrowerService
      .loanSummary(borrowerId)
      .then((res) => {
        if (!cancelled) setSummary(res ?? null);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [borrowerId, loans]);
  return summary;
}
