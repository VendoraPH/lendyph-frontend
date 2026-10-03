// Why `PATCH /loans/{id}/release` answered 409. Two different refusals share the
// status, and the dialog has to do different things for each:
//
// - `fees_changed`: the fee configuration moved after the release preview was
//   read (the body names `fee_fingerprint`). Nothing was released; quote the
//   fees again and keep the dialog open on the new figures.
// - `loan_changed`: another request changed this loan first — released it,
//   voided it, sent it back — or a lock clash was rolled back. Nothing was
//   written; the loan has to be read again to show where it now stands.

import { httpStatusOf } from "@/lib/api-error";

export type ReleaseConflict = "fees_changed" | "loan_changed";

interface ConflictBody {
  response?: { data?: { errors?: Record<string, unknown> } };
}

export function releaseConflictOf(err: unknown): ReleaseConflict | null {
  if (httpStatusOf(err) !== 409) return null;
  const errors = (err as ConflictBody | null)?.response?.data?.errors;
  return errors && "fee_fingerprint" in errors ? "fees_changed" : "loan_changed";
}
