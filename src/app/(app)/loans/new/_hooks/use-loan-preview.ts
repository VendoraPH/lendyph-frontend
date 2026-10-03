import { useEffect, useState } from "react";
import { loanService } from "@/services/loan.service";
import type { LoanFormPreviewRequest } from "@/types";
import {
  loanPreviewFailureMessage,
  loanPreviewKey,
  loanPreviewView,
  type LoanPreviewOutcome,
  type LoanPreviewView,
} from "../_lib/loan-preview";

/** Long enough to wait out typing, short enough to feel immediate. */
const DEBOUNCE_MS = 300;

/**
 * The server's preview (`POST /loans/preview`) of the loan form as it stands,
 * asked for once typing pauses. A request for inputs that have since changed
 * is cancelled, and its answer ignored if it arrives anyway, so the form only
 * ever shows the preview of the inputs it holds. `request` null means there is
 * nothing to preview.
 */
export function useLoanPreview(
  request: LoanFormPreviewRequest | null,
): { view: LoanPreviewView; retry: () => void } {
  const [outcome, setOutcome] = useState<LoanPreviewOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Keyed by content, so a re-render that rebuilds an equal body neither
  // re-asks nor drops the answer already shown.
  const key = loanPreviewKey(request);

  useEffect(() => {
    if (key === null) return;
    const body = JSON.parse(key) as LoanFormPreviewRequest;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loanService
        .preview(body, controller.signal)
        .then((preview) => {
          if (controller.signal.aborted) return;
          setOutcome({ key, attempt, view: { status: "ready", preview } });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setOutcome({
            key,
            attempt,
            view: { status: "error", message: loanPreviewFailureMessage(err) },
          });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, attempt]);

  return {
    view: loanPreviewView(key, attempt, outcome),
    retry: () => setAttempt((n) => n + 1),
  };
}
