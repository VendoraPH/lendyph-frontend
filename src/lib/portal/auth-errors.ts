import { getErrorMessage, httpStatusOf } from "@/lib/api-error";

/**
 * What to tell a member when a sign-in, activation or reset step fails.
 *
 * Deliberately vague on 401 and 404: "that account does not exist" would let
 * anyone test which membership numbers are real. The server answers a wrong
 * identifier and a wrong password the same way, and so does this.
 */
export function portalAuthMessage(err: unknown, step: "login" | "verify" | "otp" | "password"): string {
  const status = httpStatusOf(err);
  if (status === 501) return "Online access is not available yet. Please contact your cooperative.";
  if (status === 423) return "Your online access is locked after too many attempts. Try again later or contact your branch.";
  if (status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  if (status === 403) return "Online access is disabled for this account. Please contact your branch.";
  if (step === "login" && (status === 401 || status === 404)) {
    return "The details you entered do not match our records.";
  }
  if (step === "verify" && (status === 404 || status === 422)) {
    return "We could not verify those details. Check them, or ask your branch for an invitation.";
  }
  if (step === "otp" && (status === 422 || status === 410)) {
    return "That code is wrong or has expired. Request a new one.";
  }
  if (step === "otp" && status === 404) {
    return "Online access is not available yet. Please contact your cooperative.";
  }
  return getErrorMessage(err, "Something went wrong. Please try again.");
}
