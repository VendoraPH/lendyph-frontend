import { useCallback, useEffect, useRef, useState } from "react";
import { loanApprovalService } from "@/services/loan-approval.service";
import {
  isApprovalChainHidden,
  type LoanApprovalRound,
  type LoanApprovalStep,
} from "@/types";

interface UseLoanApprovalResult {
  steps: LoanApprovalStep[];
  rounds: LoanApprovalRound[];
  /** First load only — a `refresh()` after an action does not blank the chain. */
  loading: boolean;
  /**
   * The chain could not be read. TRUE is not "no approvals": the card must say
   * the chain is unavailable rather than render an empty or invented one.
   */
  unavailable: boolean;
  refresh: () => Promise<void>;
}

/**
 * Read a loan's approval chain from the server.
 *
 * Read-only by design. Acting on a step goes through `loanApprovalService`
 * directly and is followed by `refresh()` — the server decides what the chain
 * looks like afterwards, so nothing here patches state from an action's
 * response. That is the whole point of moving off `localStorage`: the browser
 * gets to display the chain, not to decide it.
 *
 * Skips the fetch entirely once the loan is `rejected` or `void`; those loans
 * have no live chain and asking for one only produces a 404 to swallow.
 */
export function useLoanApproval(
  loanId: number | undefined,
  status: string | undefined,
): UseLoanApprovalResult {
  const [steps, setSteps] = useState<LoanApprovalStep[]>([]);
  const [rounds, setRounds] = useState<LoanApprovalRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  // Guards against an in-flight read landing after a newer one (or after the
  // user has navigated to another loan) and overwriting the fresher answer.
  const requestRef = useRef(0);

  const hidden = isApprovalChainHidden(status);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (!loanId || hidden) {
        requestRef.current++;
        setSteps([]);
        setRounds([]);
        setUnavailable(false);
        setLoading(false);
        return;
      }
      const token = ++requestRef.current;
      if (showSpinner) setLoading(true);
      try {
        const state = await loanApprovalService.state(loanId);
        if (token !== requestRef.current) return;
        setSteps(Array.isArray(state?.current_steps) ? state.current_steps : []);
        setRounds(Array.isArray(state?.rounds) ? state.rounds : []);
        setUnavailable(false);
      } catch {
        if (token !== requestRef.current) return;
        // 404 until the backend ships, and for any loan whose chain was never
        // seeded. Either way there is nothing trustworthy to show.
        setSteps([]);
        setRounds([]);
        setUnavailable(true);
      } finally {
        if (token === requestRef.current && showSpinner) setLoading(false);
      }
    },
    [loanId, hidden],
  );

  // No cleanup: `load` bumps the token on entry, so starting a read is itself
  // what cancels the previous one. A read still in flight at unmount resolves
  // into a no-op setState, which React 19 neither warns about nor acts on.
  useEffect(() => {
    void load(true);
  }, [load]);

  const refresh = useCallback(() => load(false), [load]);

  return { steps, rounds, loading, unavailable, refresh };
}
