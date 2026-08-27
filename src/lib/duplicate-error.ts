// Detects the backend's "this applicant already exists" 422 rejections so the
// UI can show friendly copy instead of the raw messages — which either carry
// the internal "Pass force=true" hint (stripped by the api-error leak guard,
// leaving only a vague "review the details" message) or read too technically
// ("The email has already been taken.").
//
// Pure and dependency-light (only the pure field-error reader) so it is
// unit-testable via `tsx --test`.

import { getFieldErrors } from "@/lib/api-error";

// The name + birthdate duplicate. This match is bypassable with force=true,
// which is exactly what the admin "Create Anyway" flow does, so the admin
// duplicate dialog keys off this. Raw copy looks like:
//   "A similar borrower already exists: <Name> (BRW-XXXXXX, born YYYY-MM-DD). Pass force=true to create anyway."
export function isDuplicateNameMessage(message?: string | null): boolean {
  if (!message) return false;
  return /similar borrower|force=true|already exists/i.test(message);
}

// A unique-email collision as worded for a SIGNED-IN user (staff creating a
// borrower): the backend is free to be explicit there, because the person
// already has access to the member list.
const EMAIL_TAKEN = /already been taken|already registered/i;

// The same collision as worded for an ANONYMOUS applicant on the public form:
//   "This email cannot be used. Please contact your branch to continue."
// It shares no wording with the authenticated copy, so it needs its own
// pattern. The vagueness is deliberate and stays as-is on the backend —
// confirming that an address is on file would let anyone enumerate who borrows
// at a branch — which is why this is fixed here in the matcher instead.
//
// Kept as a separate named pattern rather than loosened into EMAIL_TAKEN so a
// later edit to either one cannot quietly start swallowing ordinary validation
// copy about the email field.
const ANONYMOUS_EMAIL_COLLISION = /this email cannot be used/i;

// True when a create/registration 422 signals the applicant already exists —
// a name+birthdate duplicate, or a unique-email collision in either its
// authenticated or its anonymous wording. The public registration flow uses
// this to show one clear "already registered" message (a public applicant has
// no session, so it cannot tell pending from member).
export function isAlreadyRegisteredError(err: unknown): boolean {
  return getFieldErrors(err).some(
    (m) =>
      isDuplicateNameMessage(m) ||
      EMAIL_TAKEN.test(m) ||
      ANONYMOUS_EMAIL_COLLISION.test(m)
  );
}
