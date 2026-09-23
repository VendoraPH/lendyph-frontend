import type { UpdateUserData } from "@/services/user.service";
import type { User } from "@/types";
import { primaryBranchId, userBranchIds } from "./user-branches";

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
 * `mobile_number` sends an explicit `null` when the field is emptied, rather
 * than omitting the key: an omitted key leaves the stored number untouched, so
 * `null` is what actually clears it. Same `|| null` pattern as the borrower
 * edit form.
 *
 * The API already accepts this as-is — the rule is
 * `['nullable','string','max:20']`, the column is nullable, the field is
 * fillable, and `ConvertEmptyStringsToNull` sits in the global middleware
 * stack. Clearing the number was never waiting on a backend change.
 *
 * `branch_id` rides along with `branch_ids` while the API accepts both shapes,
 * so this request lands correctly whichever side merges first. It is not an
 * independent field: it is derived from `branch_ids` as a set, so the
 * change-check below still governs everything the payload carries.
 */
export function userEditPayload(form: UserEditForm): UpdateUserData {
  return {
    first_name: form.first_name,
    last_name: form.last_name,
    email: form.email,
    mobile_number: form.mobile_number.trim() || null,
    branch_ids: form.branch_ids,
    branch_id: primaryBranchId(form.branch_ids),
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
 * — it compares exactly what `userEditPayload()` sends, field for field.
 *
 * Clearing a phone number is a change like any other, because the payload
 * sends `null` for it. When it dropped the key instead, the number could never
 * be cleared: on its own the save read as "no changes", and alongside another
 * edit it answered "User updated" while the old number stayed put.
 */
export function userEditChanges(user: User, form: UserEditForm): string[] {
  const payload = userEditPayload(form);
  const changed: string[] = [];

  if (payload.first_name !== user.first_name) changed.push("first_name");
  if (payload.last_name !== user.last_name) changed.push("last_name");
  if (payload.email !== user.email) changed.push("email");

  // Compare both sides normalized: a cleared field is `null` in the payload and
  // may be `null` or `""` on the user, and those are all the same state. Left
  // un-normalized, every untouched form for a user who has no phone number
  // would report a change and send a PUT the server answers with a 422.
  if ((payload.mobile_number ?? "") !== (user.mobile_number ?? "")) {
    changed.push("mobile_number");
  }

  // `userBranchIds` rather than `user.branches.map(...)`: the user here comes
  // straight off the wire, and during the rollout it may still carry the
  // single `branch` instead. Comparing against [] for such a user would report
  // a branch change on every untouched form and send a pointless PUT.
  if (!sameBranchIds(payload.branch_ids ?? [], userBranchIds(user))) {
    changed.push("branch_ids");
  }
  if (payload.role !== (user.roles?.[0] ?? "")) changed.push("role");

  return changed;
}
