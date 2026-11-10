import { useState } from "react";
import { mintIdempotencyKey } from "@/lib/idempotency-key";

/**
 * Should a failed submission keep its idempotency key for the retry?
 *
 * Yes when the server may have saved it anyway: no response at all (timeout,
 * dropped connection) or a 5xx. Retrying under the same key then returns what
 * the first try created instead of creating a twin.
 *
 * No on a 4xx: the server refused it, nothing was saved, and the user is about
 * to change the form. Reusing the key with a different amount would be refused
 * as a conflicting replay.
 */
export function keepKeyAfterFailure(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  return status === undefined || status >= 500;
}

export type GuardedSubmit = <T>(submit: (key: string | null) => Promise<T>) => Promise<T> | null;

export interface SubmitAttempts {
  /** True while a submission is in flight. */
  readonly busy: boolean;
  /**
   * Run `submit` with this attempt's idempotency key, unless one is already in
   * flight: then it returns `null` and does nothing. The key survives a
   * failure that may have saved (`keepKeyAfterFailure`) and is dropped on
   * success or a refusal, so the next attempt gets a fresh one.
   */
  run: GuardedSubmit;
}

/**
 * The guard itself, free of React so it runs under `tsx --test`.
 * `onBusyChange` hears every start and end; `mint` is injectable for tests.
 */
export function createSubmitGuard(
  onBusyChange: (busy: boolean) => void = () => {},
  mint: () => string | null = () => mintIdempotencyKey(),
): SubmitAttempts {
  let busy = false;
  let key: string | null = null;

  const settle = () => {
    busy = false;
    onBusyChange(false);
  };

  const run: GuardedSubmit = <T,>(submit: (key: string | null) => Promise<T>) => {
    if (busy) return null;
    busy = true;
    onBusyChange(true);
    key ??= mint();

    let attempt: Promise<T>;
    try {
      attempt = submit(key);
    } catch (err) {
      attempt = Promise.reject(err);
    }

    return attempt
      .then(
        (result) => {
          key = null;
          return result;
        },
        (err: unknown) => {
          if (!keepKeyAfterFailure(err)) key = null;
          throw err;
        },
      )
      .finally(settle);
  };

  return {
    get busy() {
      return busy;
    },
    run,
  };
}

export interface SubmitGuard {
  /** True while a submission is in flight; disable the button on it. */
  submitting: boolean;
  /** See `SubmitAttempts.run`. */
  run: GuardedSubmit;
}

/**
 * Guards a form against double submission.
 *
 * Disabling the button alone doesn't: two clicks inside one frame both run
 * before React re-renders the button disabled. The guard's flag is set
 * synchronously, so the second click sees it. The idempotency key covers what
 * the flag can't, a retry after a lost response, and the server dedupes on it.
 */
export function useSubmitGuard(): SubmitGuard {
  const [submitting, setSubmitting] = useState(false);
  const [guard] = useState(() => createSubmitGuard(setSubmitting));
  return { submitting, run: guard.run };
}
