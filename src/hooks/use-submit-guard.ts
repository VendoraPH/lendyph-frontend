import { useCallback, useRef, useState } from "react";
import { mintIdempotencyKey } from "@/lib/idempotency-key";

/**
 * Should a failed submission keep its idempotency key for the retry?
 *
 * Yes when the server may have posted it anyway: no response at all (timeout,
 * dropped connection) or a 5xx. Retrying under the same key then returns the
 * transaction the first attempt made instead of posting a twin.
 *
 * No on a 4xx: the server refused it, nothing was posted, and the user is
 * about to change the form. Reusing the key with a different amount would be
 * refused as a conflicting replay.
 */
export function keepKeyAfterFailure(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  return status === undefined || status >= 500;
}

export interface SubmitGuard {
  /** True while a submission is in flight; disable the button on it. */
  submitting: boolean;
  /**
   * Run `submit` with this attempt's idempotency key, unless one is already in
   * flight — then it returns `null` and does nothing. The key survives a
   * failure that may have posted (see `keepKeyAfterFailure`) and is dropped on
   * success, so the next transaction gets a fresh one.
   */
  run: <T>(submit: (key: string | null) => Promise<T>) => Promise<T> | null;
}

/**
 * Guards a form that moves money against double submission.
 *
 * Disabling the button alone does not: two clicks inside one frame both run
 * before React re-renders the button disabled. The ref is set synchronously,
 * so the second click sees it. The key covers what the ref cannot — a retry
 * after a lost response — and the backend dedupes on it.
 */
export function useSubmitGuard(): SubmitGuard {
  const busy = useRef(false);
  const key = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const run = useCallback(<T,>(submit: (key: string | null) => Promise<T>) => {
    if (busy.current) return null;
    busy.current = true;
    setSubmitting(true);
    key.current ??= mintIdempotencyKey();

    return submit(key.current)
      .then(
        (result) => {
          key.current = null;
          return result;
        },
        (err: unknown) => {
          if (!keepKeyAfterFailure(err)) key.current = null;
          throw err;
        },
      )
      .finally(() => {
        busy.current = false;
        setSubmitting(false);
      });
  }, []);

  return { submitting, run };
}
