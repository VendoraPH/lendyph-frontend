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

/**
 * Who is looking at a branch list: the branches they are assigned to, and
 * whether they hold `branches:view_all`.
 *
 * The API scopes every branch-bound read to the caller's own branches unless
 * they hold `view_all` (App\Services\BranchAccess): another branch's record
 * answers 404 and a `branch_id` filter outside their branches answers 403. But
 * `GET /branches` still lists every branch, so the browser has to narrow the
 * pickers itself, or it offers choices the server will refuse.
 */
export interface BranchViewer {
  viewAll: boolean;
  branchIds: readonly number[];
}

/**
 * The viewer for a signed-in user. `viewAll` is passed in, not read from
 * `user.permissions`, so this stays free of the auth store: callers hand it
 * `can("branches:view_all")`.
 */
export function branchViewer(
  user: BranchBearing | null | undefined,
  viewAll: boolean,
): BranchViewer {
  return { viewAll, branchIds: userBranchIds(user) };
}

/**
 * The branches a viewer may pick or filter by: all of them with `view_all`,
 * otherwise only their own, in the order the list gave them.
 *
 * No viewer means no narrowing, so callers that already pass the user's own
 * branches (the member form) need no change.
 */
export function visibleBranches<T extends { id: number }>(
  branches: readonly T[],
  viewer?: BranchViewer,
): T[] {
  if (!viewer || viewer.viewAll) return [...branches];
  const own = new Set(viewer.branchIds);
  return branches.filter((b) => own.has(b.id));
}

/**
 * True when the API will show this user no branch data at all: they are
 * assigned to no branch and do not hold `branches:view_all`. The screens say
 * so instead of rendering empty lists that read as "no loans yet".
 *
 * A null user (before the auth store rehydrates, or on a public page) is not
 * this case: nothing is known yet, so nothing is claimed.
 */
export function lacksBranchAccess(
  user: BranchBearing | null | undefined,
  viewAll: boolean,
): boolean {
  if (!user || viewAll) return false;
  return userBranches(user).length === 0;
}

/** What a branch picker renders for one signed-in user. */
export interface BranchPicker<T> {
  viewer: BranchViewer;
  /** The branches to offer (`visibleBranches`). */
  branches: T[];
  /** The label of the "every branch" option (`allBranchesLabel`). */
  allLabel: string;
}

/**
 * Everything a branch picker needs, from the raw inputs a component has: the
 * loaded branch list, the signed-in user, and `can("branches:view_all")`.
 *
 * One call per picker, so every picker builds its viewer the same way and the
 * options and the "all" label can't disagree.
 */
export function branchPicker<T extends { id: number }>(
  branches: readonly T[],
  user: BranchBearing | null | undefined,
  viewAll: boolean,
): BranchPicker<T> {
  const viewer = branchViewer(user, viewAll);
  return { viewer, branches: visibleBranches(branches, viewer), allLabel: allBranchesLabel(viewer) };
}

/**
 * The name of the branch a picker has selected, or, with none selected, what
 * "every branch" covers for this viewer: `viewAllLabel` with
 * `branches:view_all`, otherwise the picker's own label ("All my branches"),
 * because the API then reads no `branch_id` as the caller's branches only.
 *
 * A selected id the picker doesn't offer falls back the same way: the label
 * never names a branch the viewer can't pick.
 */
export function pickedBranchLabel<T extends { id: number; name: string }>(
  picker: BranchPicker<T>,
  branchId: number | null,
  viewAllLabel = "All branches",
): string {
  const picked = branchId === null ? undefined : picker.branches.find((b) => b.id === branchId);
  if (picked) return picked.name;
  return picker.viewer.viewAll ? viewAllLabel : picker.allLabel;
}

/**
 * True when the API will refuse to act on `target` (edit, reset password,
 * deactivate) because they also work in a branch the caller doesn't hold. It
 * answers that refusal as a 404, the same as a missing user, so the page has
 * to know before the click.
 *
 * Never for a caller with `view_all`, for the caller's own account, or before
 * the caller is known.
 */
export function worksOutsideCallerBranches(
  target: BranchBearing & { id: number },
  caller: (BranchBearing & { id: number }) | null | undefined,
  viewAll: boolean,
): boolean {
  if (!caller || viewAll || caller.id === target.id) return false;
  const own = new Set(userBranchIds(caller));
  return userBranchIds(target).some((id) => !own.has(id));
}

/** One option of a Base UI `<Select items>` list. */
export interface BranchSelectItem {
  value: string;
  label: string;
}

/**
 * The `items` for a branch `<Select>`. Base UI resolves the trigger's label
 * from `items`, so without them the closed select shows the raw value.
 *
 * Pass the viewer to offer only the branches they may pick (`visibleBranches`).
 */
export function branchSelectItems(
  branches: readonly UserBranch[],
  viewer?: BranchViewer,
): BranchSelectItem[] {
  return visibleBranches(branches, viewer).map((b) => ({ value: String(b.id), label: b.name }));
}

/**
 * The label of a branch filter's "every branch" option. For a viewer without
 * `view_all` it means every branch of THEIRS (the API reads no `branch_id` as
 * all of the caller's branches), so it says so.
 */
export function allBranchesLabel(viewer?: BranchViewer): string {
  return viewer && !viewer.viewAll ? "All my branches" : "All branches";
}

/**
 * The `items` for a branch filter `<Select>` whose `allValue` means "every
 * branch". Without an item for that value the closed select shows it raw.
 *
 * Pass the viewer to offer only the branches they may filter by.
 */
export function branchFilterItems(
  branches: readonly UserBranch[],
  allValue: string,
  viewer?: BranchViewer,
): BranchSelectItem[] {
  return [
    { value: allValue, label: allBranchesLabel(viewer) },
    ...branchSelectItems(branches, viewer),
  ];
}
