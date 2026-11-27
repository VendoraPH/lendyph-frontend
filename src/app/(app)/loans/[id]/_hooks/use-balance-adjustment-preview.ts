import { useEffect, useState } from "react";
import { loanAdjustmentService } from "@/services";
import { getErrorMessage } from "@/lib/api-error";
import {
  readBalanceAdjustmentPreview,
  type BalanceAdjustmentPreviewView,
} from "../_lib/balance-adjustment";

/** Long enough to wait out typing, short enough to feel immediate. */
const DEBOUNCE_MS = 300;

interface Answer {
  key: string;
  preview: BalanceAdjustmentPreviewView | null;
  error: string | null;
}

/**
 * The server's balance adjustment preview for the target typed now, asked for
 * once typing pauses and only while `target` is a valid figure. A request for
 * a target that has since changed is cancelled, and its answer ignored if it
 * arrives anyway, so the dialog only shows figures for what is typed now.
 */
export function useBalanceAdjustmentPreview(
  loanId: number,
  target: string | null,
): { loading: boolean; preview: BalanceAdjustmentPreviewView | null; error: string | null } {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const key = target === null ? null : JSON.stringify([loanId, target]);

  useEffect(() => {
    if (key === null) return;
    const [id, value] = JSON.parse(key) as [number, string];
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loanAdjustmentService
        .balancePreview(id, value, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          const preview = readBalanceAdjustmentPreview(data);
          setAnswer({
            key,
            preview,
            error: preview === null ? "The server's preview could not be read." : null,
          });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setAnswer({
            key,
            preview: null,
            error: getErrorMessage(err, "We couldn't preview this adjustment. Please try again."),
          });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  const current = key !== null && answer?.key === key ? answer : null;
  return {
    loading: key !== null && current === null,
    preview: current?.preview ?? null,
    error: current?.error ?? null,
  };
}
