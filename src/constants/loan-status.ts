/**
 * The loan status vocabulary: the enum values, their labels, and their badge
 * colours.
 *
 * A module of its own rather than three more consts in `constants/index.ts`,
 * for the reason the barrel exists at all — `index.ts` also re-exports
 * `./navigation`, which pulls in React components and `@/config/env`. Keeping
 * this importable on its own is what lets it be unit-tested in a plain node
 * process. Everything here is re-exported from `@/constants`, so no consumer's
 * import path changes.
 */

import type { LoanStatus } from "@/types/loan";

export const LOAN_STATUS = {
  DRAFT: "draft",
  FOR_REVIEW: "for_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  RELEASED: "released",
  CURRENT: "current",
  PAST_DUE: "past_due",
  ONGOING: "ongoing",
  COMPLETED: "completed",
  DEFAULTED: "defaulted",
  RESTRUCTURED: "restructured",
  CLOSED: "closed",
  VOID: "void",
} as const;

// ---------------------------------------------------------------------------
// Loan status vocabulary
// ---------------------------------------------------------------------------
//
// Both maps below are `Record<LoanStatus, string>`, NOT `Record<string, string>`.
//
// That single change is the guard. As `Record<string, string>` a missing status
// is not an error anywhere — the lookup just returns `undefined`, the label
// falls through to the raw enum value and the badge renders `className={undefined}`.
// That is precisely how `void` shipped: `LoanService::voidLoan()` has set it for
// months and `LoanController::index()` counts it, but no map had the key, so a
// voided loan drew an unstyled pill reading "void" and nobody's build broke.
//
// Keyed off the model type instead, the next status added to `LoanStatus` fails
// to compile here until it has both a label and a colour. `statusBadgeColor` in
// `borrowers/_components/utils.ts` has always been written this way, which is
// why `rejected` was styled correctly over there without anyone remembering to
// do it.

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  draft: "Draft",
  for_review: "For Review",
  approved: "Approved",
  rejected: "Rejected",
  released: "Released",
  current: "Current",
  past_due: "Past Due",
  // Legacy — older backend versions may still emit "ongoing" for a loan
  // that has been released and is on an amortization schedule. Display it
  // the same as "current" so the UI stays consistent until backend
  // migration.
  ongoing: "Current",
  completed: "Completed",
  defaulted: "Defaulted",
  restructured: "Restructured",
  closed: "Closed",
  // "Voided", not "Void", to match the past-participle state wording of every
  // other label here and the payment detail screen's existing "Voided".
  void: "Voided",
};

/**
 * Badge classes for a loan status pill.
 *
 * One definition, because there were two: an identical copy in
 * `loans/_components/loan-table.tsx` and another in `loans/[id]/page.tsx` that
 * had silently drifted — the detail page's was missing `ongoing`, so a released
 * loan on a schedule drew an unstyled badge on the very screen you open to
 * check it. Two hand-maintained copies of the same map is the "the fix landed
 * in one file and didn't spread" shape; there is now one.
 *
 * A third copy still lives in `borrowers/[id]/_components/loans-tab.tsx`
 * (`loanStatusColor`) and should be folded in here too — it belongs to another
 * module and was left alone deliberately.
 */
export const LOAN_STATUS_COLORS: Record<LoanStatus, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  for_review: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  approved: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800",
  rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  released: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-800",
  current: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  past_due: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  ongoing: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  completed: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  defaulted: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  restructured: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-800",
  closed: "bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  // Struck through, and the only status here that is: a voided loan is not a
  // finished one, it is one that no longer counts. `statusBadgeColor.rejected`
  // in the borrowers module already uses this treatment for the same meaning.
  // The semantic tokens carry their own dark variants, so no `dark:` pairs.
  void: "bg-muted text-muted-foreground border-border line-through",
};
