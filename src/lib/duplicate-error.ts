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

// True when a create/registration 422 signals the applicant already exists —
// either a name+birthdate duplicate or a unique-email collision. The public
// registration flow uses this to show one clear "already registered" message
// (a public applicant has no session, so it cannot tell pending from member).
export function isAlreadyRegisteredError(err: unknown): boolean {
  return getFieldErrors(err).some(
    (m) => isDuplicateNameMessage(m) || /already been taken|already registered/i.test(m)
  );
}
