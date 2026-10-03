import { useEffect, useState } from "react";
import { gcashService } from "@/services/gcash.service";
import type { GCashTransactionType } from "@/types";
import {
  chargePreviewView,
  isPreviewableAmount,
  previewFailureView,
  type ChargePreviewOutcome,
  type ChargePreviewView,
} from "../_lib/charge-preview";

/** Long enough to wait out typing, short enough to feel immediate. */
const DEBOUNCE_MS = 300;

/**
 * The server's charge and total for `amount`, asked for once typing pauses.
 * A request for an amount that has since changed is cancelled, and its answer
 * ignored if it arrives anyway, so the dialog only ever shows the preview of
 * the amount in the box.
 */
export function useGCashChargePreview(
  type: GCashTransactionType,
  amount: number,
): { view: ChargePreviewView; retry: () => void } {
  const [outcome, setOutcome] = useState<ChargePreviewOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isPreviewableAmount(amount)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      gcashService
        .previewCharge(type, amount, controller.signal)
        .then((preview) => {
          if (controller.signal.aborted) return;
          setOutcome({ amount, attempt, view: { status: "ready", preview } });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setOutcome({ amount, attempt, view: previewFailureView(err) });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [type, amount, attempt]);

  return {
    view: chargePreviewView(amount, attempt, outcome),
    retry: () => setAttempt((n) => n + 1),
  };
}
