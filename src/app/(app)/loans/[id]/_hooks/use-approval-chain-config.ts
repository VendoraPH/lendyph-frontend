"use client";

import { useEffect, useState } from "react";
import { approvalWorkflowService, type ApprovalChainStep } from "@/services";

// Loads the admin-configured approval chain for this loan. The chain depends
// on whether this is a policy exception (different chain) or a normal loan.
// Falls back to the built-in default if the API request fails.
export function useApprovalChainConfig(
  loanId: number | undefined,
  policyException: boolean | undefined,
) {
  const [chainConfig, setChainConfig] = useState<ApprovalChainStep[] | null>(null);

  useEffect(() => {
    if (loanId == null) return;
    let cancelled = false;
    const isPolicyException = policyException === true;
    approvalWorkflowService
      .listForLoan(isPolicyException)
      .then((chain) => {
        if (!cancelled) setChainConfig(chain);
      })
      .catch(() => {
        if (!cancelled) {
          setChainConfig(
            isPolicyException
              ? approvalWorkflowService.getDefault()
              : approvalWorkflowService.getDefaultNormal(),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loanId, policyException]);

  return chainConfig;
}
