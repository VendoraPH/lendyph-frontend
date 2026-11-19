import { parseEditLoanId } from "@/app/(app)/loans/new/_lib/edit-loan-id";

/** "1 loan application awaiting approval" / "3 loan applications awaiting approval". */
export function countLabel(count: number | undefined, noun: string, state: string): string | undefined {
  if (!count || count <= 0) return undefined;
  return `${count} ${noun}${count === 1 ? "" : "s"} ${state}`;
}

/**
 * The accessible name of a collapsed sidebar link, which shows only an icon:
 * its menu title, then what its badge counts when it has one.
 */
export function collapsedNavLabel(title: string, badgeLabel?: string): string {
  return badgeLabel ? `${title}, ${badgeLabel}` : title;
}

/**
 * The path the menu highlights. The loan form in edit mode
 * (`/loans/new?edit={id}`, read as the page reads it) edits an existing loan,
 * so it highlights All Loans, not New Application.
 */
export function navActivePath(pathname: string, editParam: string | null): string {
  if (pathname === "/loans/new" && parseEditLoanId(editParam) !== null) return "/loans";
  return pathname;
}

/** "4 new in Loans": a menu link's unviewed notifications, in words. */
export function newLabel(count: number | undefined, title: string): string | undefined {
  if (!count || count <= 0) return undefined;
  return `${count} new in ${title}`;
}
