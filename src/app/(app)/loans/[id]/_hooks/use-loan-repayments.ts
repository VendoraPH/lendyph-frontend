"use client";

import { useCallback, useEffect, useState } from "react";
import { repaymentService } from "@/services";
import type { Repayment } from "@/types";

const TRIGGER_STATUSES = [
  "released",
  "ongoing",
  "completed",
  "defaulted",
  "restructured",
  "closed",
] as const;

// Repayments for released+ loans, enriched with per-repayment breakdown.
// The list endpoint omits breakdown fields (principal_paid, interest_paid,
// scb_paid, penalty_paid); the detail endpoint includes them.
export function useLoanRepayments(loanId: number | undefined, status: string | undefined) {
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRepayments = useCallback(async (id: number) => {
    try {
      setLoading(true);
      const res = await repaymentService.list(id);
      const list: Repayment[] = Array.isArray(res) ? res : res.data ?? [];
      const enriched = await Promise.all(
        list.map(async (r) => {
          try {
            const detail = await repaymentService.detail(r.id);
            const d = detail as Repayment & Record<string, unknown>;
            return {
              ...r,
              ...detail,
              principal_paid:
                (detail.principal_paid ?? (d.principal_amount as number)) || undefined,
              interest_paid:
                (detail.interest_paid ?? (d.interest_amount as number)) || undefined,
              scb_paid: (detail.scb_paid ?? (d.scb_amount as number)) || undefined,
              penalty_paid:
                (detail.penalty_paid ?? (d.penalty_amount as number)) || undefined,
            } as Repayment;
          } catch {
            return r;
          }
        }),
      );
      setRepayments(enriched);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loanId && status && (TRIGGER_STATUSES as readonly string[]).includes(status)) {
      fetchRepayments(loanId);
    }
  }, [loanId, status, fetchRepayments]);

  return { repayments, loading, refetch: fetchRepayments, setRepayments };
}
