import { useCallback, useEffect, useState } from "react";
import { loanService, type ReleasePreviewInsuranceQuery } from "@/services/loan.service";
import {
  releaseInsuranceFailureMessage,
  releaseInsuranceKey,
  releaseInsuranceView,
  type ReleaseInsuranceOutcome,
  type ReleaseInsuranceView,
} from "../_lib/release-figures";

/** Long enough to wait out typing, short enough to feel immediate. */
const DEBOUNCE_MS = 300;

/**
 * The server's release preview with the insurance the cashier has typed
 * (`GET /loans/{id}/release-preview?insurance_…`), asked for once typing
 * pauses and only while `enabled` (the Release dialog is open). A request for
 * an insurance that has since changed is cancelled, and its answer ignored if
 * it arrives anyway, so the dialog only shows figures for what is typed now.
 * `query` null means no insurance, and nothing is asked.
 *
 * Kept apart from `useReleasePreview`, which the Loan Information card shares:
 * a refused insurance (a partial amount above the premium) fails here alone,
 * and the fee list above it stays on screen.
 *
 * `premiumAmount` is the server's premium for the percentage typed now, from
 * the latest answer for that percentage. The premium depends on nothing else,
 * so it stays known while a partial amount the server refuses is corrected.
 */
export function useReleaseInsurancePreview(
  loanId: number,
  query: ReleasePreviewInsuranceQuery | null,
  enabled: boolean,
): { view: ReleaseInsuranceView; premiumAmount: string | null; retry: () => void } {
  const [outcome, setOutcome] = useState<ReleaseInsuranceOutcome | null>(null);
  const [premium, setPremium] = useState<{ key: string; amount: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Keyed by content, so a re-render that rebuilds an equal query neither
  // re-asks nor drops the answer already shown.
  const key = enabled ? releaseInsuranceKey(loanId, query) : null;

  useEffect(() => {
    if (key === null) return;
    const [id, params] = JSON.parse(key) as [number, ReleasePreviewInsuranceQuery];
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loanService
        .releasePreview(id, params, controller.signal)
        .then((preview) => {
          if (controller.signal.aborted) return;
          setOutcome({ key, attempt, view: { status: "ready", preview } });
          if (preview.insurance) {
            setPremium({
              key: premiumKey(id, params.insurance_premium_percentage),
              amount: preview.insurance.premium_amount,
            });
          }
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setOutcome({
            key,
            attempt,
            view: { status: "error", message: releaseInsuranceFailureMessage(err) },
          });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, attempt]);

  const currentPremiumKey =
    key !== null && query ? premiumKey(loanId, query.insurance_premium_percentage) : null;
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return {
    view: releaseInsuranceView(key, attempt, outcome),
    premiumAmount: premium !== null && premium.key === currentPremiumKey ? premium.amount : null,
    retry,
  };
}

/** The premium depends on the loan and the percentage alone. */
function premiumKey(loanId: number, percentage: number): string {
  return `${loanId}:${percentage}`;
}
