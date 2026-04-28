"use client";

import { useCallback, useEffect, useState } from "react";
import { loanAdjustmentService } from "@/services";
import type { LoanAdjustment } from "@/types";

const TRIGGER_STATUSES = [
  "released",
  "ongoing",
  "completed",
  "defaulted",
  "restructured",
  "closed",
] as const;

// Adjustments (restructure / penalty waiver / balance adjustment / term extension)
// recorded against released+ loans.
export function useLoanAdjustments(loanId: number | undefined, status: string | undefined) {
  const [adjustments, setAdjustments] = useState<LoanAdjustment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAdjustments = useCallback(async (id: number) => {
    try {
      setLoading(true);
      const res = await loanAdjustmentService.list(id);
      setAdjustments(Array.isArray(res) ? res : []);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loanId && status && (TRIGGER_STATUSES as readonly string[]).includes(status)) {
      fetchAdjustments(loanId);
    }
  }, [loanId, status, fetchAdjustments]);

  return { adjustments, loading, refetch: fetchAdjustments };
}
