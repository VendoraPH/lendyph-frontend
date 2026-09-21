// Reading a user's branch assignment, across BOTH shapes of the contract.
//
// Multi-branch assignment replaced `user.branch` with `user.branches[]`. The two
// sides ship independently, so for the whole of the rollout a `User` handed to
// this app may carry either shape — and `api.get<User>()` is an unchecked cast
// of untyped JSON, so TypeScript will not notice. `user.branches.map(...)` on a
// payload that only has `branch` is not a blank field, it is a white screen.
//
// Every read of the assignment goes through `userBranches()` for that reason.
// Three sources can hand us the old shape:
//   1. an API that has not shipped its half of the change yet;
//   2. an API that has, but is answering an endpoint that was missed;
//   3. localStorage — the auth store is persisted, so a session that signed in
//      before either side shipped rehydrates the old shape indefinitely.
//
// Dependency-free on purpose (mirrors password-change-required.ts) so it is
// unit-testable under `tsx --test` and the auth store can import it without
// dragging anything else in.

import type { UserBranch } from "@/types";

/** Anything that might carry a branch assignment, in either shape. */
export interface BranchBearing {
  branches?: UserBranch[] | null;
  branch?: UserBranch | null;
}

/**
 * A user's assigned branches, whichever shape the payload arrived in.
 *
 * Never throws and never returns undefined: an absent, null or non-array
 * `branches` falls back to the legacy single `branch`, and an account with
 * neither yields `[]`. Callers get an empty list — a blank field — instead of a
 * crash.
 *
 * `Array.isArray` rather than `?? []` deliberately: the JSON is unchecked, so
 * `branches: null` has to fall through to `branch` too, and a non-array would
 * otherwise reach `.map()`.
 */
export function userBranches(user: BranchBearing | null | undefined): UserBranch[] {
  if (!user) return [];
  if (Array.isArray(user.branches)) return user.branches;
  return user.branch ? [user.branch] : [];
}

/** The assigned branch ids, in the order the payload listed them. */
export function userBranchIds(user: BranchBearing | null | undefined): number[] {
  return userBranches(user).map((b) => b.id);
}

/**
 * The single `branch_id` to send **alongside** `branch_ids` while the backend
 * accepts and emits both shapes. Sending both is what makes either merge order
 * safe: a backend that has not shipped multi-branch yet ignores `branch_ids`
 * and reads this, and one that has prefers `branch_ids`.
 *
 * Derived from the *set*, not the selection order — the lowest id — so it is
 * stable under a reorder, exactly like `sameBranchIds()`'s comparison in
 * user-edit.ts. That matters: it means this key cannot silently differ across
 * two payloads the change-check calls identical.
 *
 * Trade-off: on a backend that still understands only `branch_id`, assigning
 * several branches necessarily collapses to one of them, and "lowest id" is an
 * arbitrary-but-deterministic choice. That window closes when the backend ships.
 */
export function primaryBranchId(branchIds: number[]): number | undefined {
  if (branchIds.length === 0) return undefined;
  return Math.min(...branchIds);
}

/**
 * Bring a user object forward to the `branches` shape.
 *
 * Fed straight from `JSON.parse` by the auth store's persist migration, so it
 * takes anything and defends: a non-object comes back untouched, and a user
 * that already has `branches` is returned **by reference** so rehydrating a
 * current session allocates nothing.
 */
export function withUserBranches<T>(user: T): T {
  if (!user || typeof user !== "object") return user;
  const bearing = user as BranchBearing;
  if (Array.isArray(bearing.branches)) return user;
  return { ...(user as object), branches: userBranches(bearing) } as T;
}
