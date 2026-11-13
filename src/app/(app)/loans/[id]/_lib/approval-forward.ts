import { roleLabelFromServer } from "@/lib/role-display-name";
import type { ForwardCandidates, ForwardToPayload, LoanApprovalStep } from "@/types/loan-approval";

/** The picker's default: no `forward_to_user_id`, so the step is its role's. */
export const ANYONE_WITH_THE_ROLE = "anyone";

export interface ForwardOption {
  value: string;
  label: string;
}

/**
 * The "Forward to" options: the role default first, then each candidate by
 * name. Only `id` and `name` are read, so nothing else a row might carry can
 * reach a label. No next step (the pending one is the last) offers none.
 */
export function forwardOptions(candidates: ForwardCandidates | null | undefined): ForwardOption[] {
  const next = candidates?.next_step;
  if (!next) return [];
  const users = Array.isArray(candidates?.users) ? candidates.users : [];
  return [
    { value: ANYONE_WITH_THE_ROLE, label: `Anyone with the ${roleLabelFromServer(next.role, next.role_label)} role` },
    ...users.map((user) => ({ value: String(user.id), label: user.name })),
  ];
}

/** The picked user's id, or null for the role default or anything that isn't a whole id above 0. */
function pickedUserId(picked: string): number | null {
  if (!/^\d+$/.test(picked.trim())) return null;
  const id = Number(picked);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** `payload` plus `forward_to_user_id` when a name was picked; unchanged otherwise. */
export function withForwardTo<T extends object>(payload: T, picked: string): T & ForwardToPayload {
  const id = pickedUserId(picked);
  return id === null ? payload : { ...payload, forward_to_user_id: id };
}

/** A pick, tied to the step (or draft) it was made on. */
export interface ForwardPick {
  key: string;
  userId: string;
  /** The picked user's name, for the success message. */
  name?: string;
}

/** The pick for the step on screen: a pick made on another step reads as the role default. */
export function forwardPickFor(pick: ForwardPick, key: string): string {
  return pick.key === key ? pick.userId : ANYONE_WITH_THE_ROLE;
}

/** The picked user's name for the step on screen, or null for the role default. */
export function forwardPickName(pick: ForwardPick, key: string): string | null {
  if (pickedUserId(forwardPickFor(pick, key)) === null) return null;
  return pick.name ?? null;
}

/**
 * ADVISORY ONLY. The gate is `step.can_act`, which the server computes for the
 * requesting user, and behind that the endpoints themselves. This exists so a
 * button can be disabled before the round trip; it must never be the reason
 * an action is considered allowed.
 *
 * - admin and super_admin may act on any step.
 * - A step forwarded to someone (`assigned_to`) is theirs. Another holder of
 *   the role may act only once the server says so (`can_act`), which it does
 *   when the assignee no longer qualifies and the step is the role's again.
 * - Otherwise the step's role decides.
 * - The server's no (`can_act: false`) always wins.
 */
export function canUserActOnStep(
  step: LoanApprovalStep,
  user: { id: number; roles?: string[] | null } | null | undefined,
): boolean {
  const roles = user?.roles ?? [];
  if (!user || roles.length === 0) return false;
  if (step.can_act === false) return false;
  if (roles.includes("admin") || roles.includes("super_admin")) return true;
  const assignee = step.assigned_to;
  if (assignee) {
    if (assignee.id === user.id) return true;
    return step.can_act === true && roles.includes(step.role);
  }
  return roles.includes(step.role);
}

/** "Assigned to <name>" for a forwarded step, else null. */
export function assignedToText(step: LoanApprovalStep): string | null {
  const name = step.assigned_to?.name;
  return name ? `Assigned to ${name}` : null;
}

/** Why the signed-in user can't act on the step, naming the assignee when there is one. */
export function notYourStepMessage(step: LoanApprovalStep, roleLabel: string, verb: string): string {
  const name = step.assigned_to?.name;
  return name
    ? `This step was forwarded to ${name}. Only they or an administrator can ${verb}.`
    : `Only a user with the ${roleLabel} role can ${verb}`;
}

/** The server's 422 message on `forward_to_user_id`, in its own words, or null. */
export function forwardFieldError(err: unknown): string | null {
  const response = (err as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (response?.status !== 422) return null;
  const errors = (response.data as { errors?: Record<string, unknown> } | null)?.errors;
  const messages = errors?.forward_to_user_id;
  const first = Array.isArray(messages) ? messages[0] : null;
  return typeof first === "string" && first !== "" ? first : null;
}
