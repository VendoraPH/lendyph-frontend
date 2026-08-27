// Consistent, professional toast wrappers over sonner. Import these instead of
// calling `toast.*` directly so tone stays uniform across the app.
//
// Copy rules: sentence case, no "successfully" filler, no trailing period on
// short success labels, and never interpolate a raw error object — always route
// errors through getErrorMessage so technical strings can't leak.

import { toast } from "sonner";
import { getErrorMessage } from "./api-error";
import { formatValidationMessage } from "./validation-message";

export { formatValidationMessage } from "./validation-message";

/**
 * Show a friendly, guarded message for any thrown value.
 *
 * `description` is for context the error itself can't carry — e.g. telling the
 * operator which part of a multi-step save did succeed. It is plain copy the
 * caller writes, never anything derived from the error.
 */
export function notifyError(
  err: unknown,
  fallback?: string,
  description?: string
): void {
  toast.error(
    getErrorMessage(err, fallback),
    description ? { description } : undefined
  );
}

/** Confirm an action succeeded. `message` states what happened, plainly. */
export function notifySuccess(message: string, description?: string): void {
  toast.success(message, description ? { description } : undefined);
}

export function notifyInfo(message: string, description?: string): void {
  toast.info(message, description ? { description } : undefined);
}

export function notifyWarning(message: string, description?: string): void {
  toast.warning(message, description ? { description } : undefined);
}

/** One pop-up listing all fields a user must fix on a failed submit. */
export function notifyValidation(fields: string[]): void {
  toast.error(formatValidationMessage(fields));
}
