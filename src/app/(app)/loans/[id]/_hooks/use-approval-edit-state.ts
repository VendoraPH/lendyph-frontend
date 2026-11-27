import { useEffect, useState } from "react";
import { loanService } from "@/services/loan.service";
import type { LoanApprovalEditState } from "@/types";
import { readApprovalEditState } from "../_lib/approval-edit";

/**
 * Whether the signed-in user may edit the loan at its approval step now
 * (`GET /loans/{id}/approval-edit`). Asked only while `ask` holds (the
 * holder of `loans:edit_in_approval`, a loan waiting at an approve step), and
 * again whenever `key` changes (the step on screen). Null while unasked,
 * loading, or after a failure: no answer is never a yes.
 */
export function useApprovalEditState(
  loanId: number | undefined,
  ask: boolean,
  key: string,
): LoanApprovalEditState | null {
  const request = ask && loanId !== undefined ? `${loanId}:${key}` : null;
  const [result, setResult] = useState<{ request: string; state: LoanApprovalEditState | null } | null>(null);

  useEffect(() => {
    if (request === null || loanId === undefined) return;
    let cancelled = false;
    loanService
      .approvalEditState(loanId)
      .then((raw) => {
        if (!cancelled) setResult({ request, state: readApprovalEditState(raw) });
      })
      .catch(() => {
        if (!cancelled) setResult({ request, state: null });
      });
    return () => {
      cancelled = true;
    };
  }, [request, loanId]);

  return request !== null && result?.request === request ? result.state : null;
}
