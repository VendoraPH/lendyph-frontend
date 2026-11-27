import { useCallback, useEffect, useState } from "react";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { getErrorMessage } from "@/lib/api-error";

export type PreviewReadState<T> =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "loaded"; preview: T };

interface Options<T> {
  /** Reads the figures. Keep it stable: declare it outside the component. */
  read: (loanId: number) => Promise<T>;
  failureMessage: string;
  loanId: number;
  enabled: boolean;
  /** A change while enabled reads again, as a fresh request. Defaults to the loan. */
  source?: unknown;
}

/**
 * One server preview of a loan's figures, read once each time `enabled` turns on
 * and again when `source` changes or on `reload`.
 *
 * Each answer is kept with the request it answers, so a reload shows loading
 * rather than the figures it is replacing: confirming against those would quote
 * the cashier the old amount.
 */
export function usePreviewRead<T>({ read, failureMessage, loanId, enabled, source = loanId }: Options<T>) {
  const [request, setRequest] = useState(0);
  // Turning on is a fresh request, like a dialog opening: no answer from an
  // earlier spell is shown again.
  if (useDialogOpening(enabled, source)) setRequest((n) => n + 1);
  const [answer, setAnswer] = useState<{
    request: number;
    state: Exclude<PreviewReadState<T>, { status: "loading" }>;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    read(loanId).then(
      (preview) => {
        if (!cancelled) setAnswer({ request, state: { status: "loaded", preview } });
      },
      (err: unknown) => {
        if (cancelled) return;
        setAnswer({
          request,
          state: { status: "failed", message: getErrorMessage(err, failureMessage) },
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, loanId, request, read, failureMessage]);

  const state: PreviewReadState<T> = answer?.request === request ? answer.state : { status: "loading" };
  const reload = useCallback(() => setRequest((n) => n + 1), []);
  return { state, reload };
}
