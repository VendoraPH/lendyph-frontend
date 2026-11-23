// The chosen primary branch on the user form (Phase 6 MB-BE6, multi-branch
// D9). It used to be the lowest branch id, picked by nobody, while the server
// used it as the user's default branch: where their journals, expenses and
// transfers go when they don't pick one (BranchAccess::defaultBranchFor).
//
// The rules are the server's (ResolvesBranchAssignment): the primary branch is
// one of the user's own branches, or Organisation-wide (no branch), which only
// a user who sees every branch may have. Organisation-wide is offered only to
// such a role and is never picked for the admin. The server decides; these
// keep the form from offering what it would refuse.

/** The Organisation-wide choice as a Select value: a Select can't hold null. */
export const ORGANISATION_WIDE = "organisation-wide";

export const PRIMARY_BRANCH_REQUIRED = "Choose the user's primary branch.";

export const OWN_PRIMARY_LOCK_REASON =
  "You can't change your own primary branch. Another administrator has to do it for you.";

/** Roles that always count, even deactivated (the server's Role::PROTECTED_KEYS). */
const ALWAYS_ACTIVE = new Set(["admin", "super_admin"]);

export interface PrimaryBranchRole {
  name: string;
  permissions?: readonly string[] | null;
  is_active?: boolean;
}

/**
 * Whether the role the form assigns sees every branch, so the user may be
 * Organisation-wide: super_admin always, any other role through
 * `branches:view_all`. A deactivated role grants nothing, except admin and
 * super_admin, which always count.
 */
export function roleSeesAllBranches(role: PrimaryBranchRole | null | undefined): boolean {
  if (!role) return false;
  if (role.name === "super_admin") return true;
  if (role.is_active === false && !ALWAYS_ACTIVE.has(role.name)) return false;
  return Array.isArray(role.permissions) && role.permissions.includes("branches:view_all");
}

export interface PrimaryBranchOption {
  value: string;
  label: string;
}

/**
 * The primary-branch choices: the user's selected branches by name, in the
 * order given, then Organisation-wide when the role sees every branch.
 */
export function primaryBranchOptions(
  branches: readonly { id: number; name: string }[],
  organisationWide: boolean,
): PrimaryBranchOption[] {
  const options = branches.map((b) => ({ value: String(b.id), label: b.name }));
  return organisationWide ? [...options, { value: ORGANISATION_WIDE, label: "Organisation-wide" }] : options;
}

/**
 * The choices for the branches and role the form assigns: those of `all`
 * (the branch list, in its order) whose ids the form holds, then
 * Organisation-wide when the role sees every branch.
 */
export function primaryBranchOptionsFor(
  all: readonly { id: number; name: string }[],
  branchIds: readonly number[],
  role: PrimaryBranchRole | null | undefined,
): PrimaryBranchOption[] {
  const assigned = new Set(branchIds);
  return primaryBranchOptions(
    all.filter((b) => assigned.has(b.id)),
    roleSeesAllBranches(role),
  );
}

/** A chosen primary branch: a branch id, null for Organisation-wide, undefined for none chosen. */
export type PrimaryBranchChoice = number | null | undefined;

/** The Select's value for a choice: the id, Organisation-wide's own value, or no value. */
export function primaryBranchValue(choice: PrimaryBranchChoice): string | null {
  if (choice === undefined) return null;
  return choice === null ? ORGANISATION_WIDE : String(choice);
}

/** The choice a Select value stands for; anything unreadable is none chosen. */
export function primaryBranchFromValue(value: string | null): PrimaryBranchChoice {
  if (value === ORGANISATION_WIDE) return null;
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const id = Number(value);
  return id > 0 ? id : undefined;
}

/**
 * The primary branch the form shows and sends: the choice while it is still
 * offered; otherwise the only selected branch when exactly one is left (never
 * Organisation-wide); otherwise none, until the admin picks. Derived on every
 * render, so taking a branch off and putting it back restores the choice.
 */
export function shownPrimaryBranch(
  choice: PrimaryBranchChoice,
  options: readonly PrimaryBranchOption[],
): PrimaryBranchChoice {
  const value = primaryBranchValue(choice);
  if (value !== null && options.some((o) => o.value === value)) return choice;
  const branches = options.filter((o) => o.value !== ORGANISATION_WIDE);
  return branches.length === 1 ? primaryBranchFromValue(branches[0].value) : undefined;
}

/**
 * What stops the form from saving the primary branch, or null. A user with
 * branches needs one chosen; with none selected yet, the branches field says
 * what is missing.
 */
export function primaryBranchProblem(choice: PrimaryBranchChoice, branchCount: number): string | null {
  return branchCount > 0 && choice === undefined ? PRIMARY_BRANCH_REQUIRED : null;
}

/**
 * Why the caller can't change this primary branch, or null. A caller who
 * doesn't see every branch can't change their own (the server answers 422).
 */
export function ownPrimaryBranchLock(args: { isSelf: boolean; viewAll: boolean }): string | null {
  return args.isSelf && !args.viewAll ? OWN_PRIMARY_LOCK_REASON : null;
}
