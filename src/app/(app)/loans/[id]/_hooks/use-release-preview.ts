import { useCallback, useEffect, useState } from "react";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { getErrorMessage } from "@/lib/api-error";
import { loanService } from "@/services/loan.service";
import type { LoanReleasePreview } from "@/types/loan";

export type ReleasePreviewState =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "loaded"; preview: LoanReleasePreview };

type Settled = Exclude<ReleasePreviewState, { status: "loading" }>;

/**
 * `GET /loans/{id}/release-preview`, read once each time `enabled` turns on
 * and again on `reload` (Try again, or after the release is refused because
 * the fees changed). The loan page shares the one answer between the Loan
 * Information card and the Release dialog.
 *
 * Each answer is kept with the request it answers, so a reload shows loading
 * rather than the figures and fingerprint it is replacing: confirming against
 * those would quote the cashier the old amount.
 */
export function useReleasePreview(loanId: number, enabled: boolean) {
  const [request, setRequest] = useState(0);
  // Turning on is a fresh request, like a dialog opening: no answer from an
  // earlier spell is shown again.
  if (useDialogOpening(enabled, loanId)) setRequest((n) => n + 1);
  const [answer, setAnswer] = useState<{ request: number; state: Settled } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loanService.releasePreview(loanId).then(
      (preview) => {
        if (!cancelled) setAnswer({ request, state: { status: "loaded", preview } });
      },
      (err: unknown) => {
        if (cancelled) return;
        setAnswer({
          request,
          state: {
            status: "failed",
            message: getErrorMessage(err, "We couldn't load the release figures. Please try again."),
          },
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, loanId, request]);

  const state: ReleasePreviewState =
    answer?.request === request ? answer.state : { status: "loading" };
  const reload = useCallback(() => setRequest((n) => n + 1), []);
  return { state, reload };
}
