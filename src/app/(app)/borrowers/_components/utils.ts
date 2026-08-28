import type { Borrower } from "@/types";

// Keyed off `Borrower["status"]` rather than a hand-written union: a new status
// on the model then fails the build here instead of silently rendering
// `className={undefined}`, which is how `rejected` slipped through unstyled.
export const statusBadgeColor: Record<Borrower["status"], string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-red-100 text-red-700 border-red-200",
  blacklisted: "bg-gray-900 text-white border-gray-700",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  rejected: "bg-muted text-muted-foreground border-border line-through",
};

/**
 * Who rejected an application, as something you can put in front of a person.
 *
 * BorrowerResource sends `rejected_by` as a bare user id and does not load the
 * `rejectedByUser` relation the model defines, so an id is usually all there
 * is. Turning it into a name would mean a `/users` lookup, which needs
 * `users:view` — a permission a registration reviewer does not necessarily
 * hold — so this degrades to the id rather than firing a request that 403s.
 *
 * The `rejected_by_user` branch goes live the day the API starts sending the
 * relation, the way LoanResource already does for loans; no UI change needed.
 * Returns null when nothing was recorded, so callers choose their own wording.
 *
 * Typed structurally rather than against `Registration` so a `Borrower` row
 * carrying the same three fields can use it too.
 */
export function reviewerLabel(source: {
  rejected_by?: number | null;
  rejected_by_user?: { full_name?: string; name?: string } | null;
}): string | null {
  const user = source.rejected_by_user;
  if (user?.full_name) return user.full_name;
  if (user?.name) return user.name;
  if (source.rejected_by != null) return `Reviewer #${source.rejected_by}`;
  return null;
}
