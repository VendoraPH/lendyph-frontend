import type { UpdateUserData } from "@/services/user.service";
import type { User } from "@/types";

/**
 * The Edit User dialog's fields, as the form holds them.
 */
export interface UserEditForm {
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  role: string;
  branch_ids: number[];
}

/**
 * The payload the dialog sends. Kept here rather than inline in the component
 * so the "did anything change?" question below is asked of the SAME object the
 * request carries — the two cannot drift.
 *
 * `mobile_number` collapses an empty string to `undefined`, i.e. the key is
 * omitted rather than sent as null. That is pre-existing behaviour and it means
 * clearing a phone number does not clear it server-side; see the note on
 * `userEditChanges()`.
 */
export function userEditPayload(form: UserEditForm): UpdateUserData {
  return {
    first_name: form.first_name,
    last_name: form.last_name,
    email: form.email,
    mobile_number: form.mobile_number || undefined,
    branch_ids: form.branch_ids,
    role: form.role,
  };
}

/**
 * Set equality for branch id lists — the form's selection order has no
 * meaning, so a reorder must not read as a change.
 */
function sameBranchIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort((x, y) => x - y);
  return [...a].sort((x, y) => x - y).every((id, i) => id === sorted[i]);
}

/**
 * Which fields this form would actually change on the given user.
 *
 * The backend now refuses a PUT that would write nothing: every rule on
 * `UpdateUserRequest` is `sometimes`, so an untouched form used to validate,
 * reach the super_admin check and return 200 having issued no UPDATE — which
 * made it a free, repeatable probe for which ids are super_admin accounts. It
 * answers 422 with a `changes` key now.
 *
 * So the dialog has to know before it asks. This mirrors the server's own test
 * — it compares exactly what `userEditPayload()` sends, and a key the payload
 * omits cannot be a change because the server never fills it.
 *
 * That last part has a visible consequence worth knowing: **clearing a phone
 * number reads as "no change"**, because the payload drops an empty
 * `mobile_number` instead of sending null. That is a real pre-existing bug —
 * the field could never be cleared — and this makes it visible rather than
 * answering "User updated" to a save that did nothing. Fixing it means sending
 * `null`, which is a backend contract question, not a change to make here.
 */
export function userEditChanges(user: User, form: UserEditForm): string[] {
  const payload = userEditPayload(form);
  const changed: string[] = [];

  if (payload.first_name !== user.first_name) changed.push("first_name");
  if (payload.last_name !== user.last_name) changed.push("last_name");
  if (payload.email !== user.email) changed.push("email");

  // Only a value the payload actually carries can change anything.
  if (payload.mobile_number !== undefined && payload.mobile_number !== (user.mobile_number ?? "")) {
    changed.push("mobile_number");
  }

  if (!sameBranchIds(payload.branch_ids ?? [], user.branches.map((b) => b.id))) {
    changed.push("branch_ids");
  }
  if (payload.role !== (user.roles?.[0] ?? "")) changed.push("role");

  return changed;
}
