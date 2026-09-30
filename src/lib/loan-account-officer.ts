// What an edit of a loan sends as its account officer. Dependency-free, so it
// runs under `tsx --test`.

import type { StaffMember } from "@/types";

/**
 * The `account_officer_id` part of an edit's `PUT /loans/{id}` body: the key
 * only when the officer changed, and `null` when it was cleared.
 *
 * The API only accepts an active user, and it checks the value it is sent. An
 * unchanged officer who has been deactivated since would 422 the whole edit, so
 * an edit to the purpose or the term could not be saved until someone picked a
 * new officer. Leaving the key out keeps the current one untouched.
 *
 * Create and restructure do not use this: a new loan always states its officer
 * (`null` for none), and it has to be an active one.
 */
export function editedAccountOfficer(
  picked: StaffMember | null,
  loaded: StaffMember | null,
): { account_officer_id?: number | null } {
  const next = picked?.id ?? null;
  return next === (loaded?.id ?? null) ? {} : { account_officer_id: next };
}
