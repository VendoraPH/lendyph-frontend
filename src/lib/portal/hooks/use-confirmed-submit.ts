import { useState } from "react";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { fieldErrorsOf } from "@/lib/portal/errors";
import { notifyPortalError } from "@/lib/portal/notify-error";
import type { Confirmed } from "@/lib/portal/portal-client";
import { whenConfirmed } from "@/lib/portal/server-confirm";
import { notifySuccess } from "@/lib/notify";

export interface ConfirmedSubmitOptions<T> {
  /** The statuses that mean it worked (`CONFIRMS`). */
  expect: readonly number[];
  /** The words once the server confirmed; a function to word a 202 apart from a 201. */
  success: string | ((data: T, status: number) => string);
  /** What failed, when the server's own words aren't there. */
  failure: string;
  onConfirmed?: (data: T, status: number) => void;
}

/**
 * Every member write goes through here: one attempt at a time (with its
 * Idempotency-Key, kept for a retry the server may already have seen), and
 * success shown only after the server's answer carries an expected status
 * (`whenConfirmed`). A 422 lands beside its fields.
 */
export function useConfirmedSubmit() {
  const { submitting, run } = useSubmitGuard();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function submit<T>(write: (key: string | null) => Promise<Confirmed<T>>, options: ConfirmedSubmitOptions<T>): Promise<void> {
    setFieldErrors({});
    return whenConfirmed(
      run(write),
      options.expect,
      (data, status) => {
        notifySuccess(typeof options.success === "function" ? options.success(data, status) : options.success);
        options.onConfirmed?.(data, status);
      },
      (err) => {
        setFieldErrors(fieldErrorsOf(err));
        notifyPortalError(err, options.failure);
      },
    );
  }

  return { submitting, submit, fieldErrors, setFieldErrors };
}
