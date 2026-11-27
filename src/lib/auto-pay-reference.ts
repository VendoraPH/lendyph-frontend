/** The server's wording when Auto-Pay is turned on without a CBS reference. */
export const AUTO_PAY_REFERENCE_REQUIRED = "Enter the CBS reference to turn Auto-Pay on.";

/** Why the Auto-Pay dialog can't save yet, in the server's words; null when it can. */
export function autoPayReferenceError(enabled: boolean, cbsReference: string): string | null {
  return enabled && cbsReference.trim() === "" ? AUTO_PAY_REFERENCE_REQUIRED : null;
}
