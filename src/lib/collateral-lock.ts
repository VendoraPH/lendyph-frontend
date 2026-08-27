/**
 * Reading `active_loans` — one definition of "is this collateral already
 * pledged", for every screen that asks.
 *
 * The server now answers this directly: `CollateralResource.active_loans` lists
 * every loan in `Loan::ACTIVE_STATUSES` holding the collateral, and
 * `CollateralController::attach()` refuses a conflicting attach outright. This
 * module exists only to read that field consistently, because there are three
 * ways to get it wrong and all three are silent:
 *
 *  1. Treating an ABSENT key as free. `active_loans` is rendered with
 *     `whenLoaded`, so a response without the relation omits it rather than
 *     sending `[]`. `!c.active_loans?.length` cannot tell "nobody holds this"
 *     from "nobody asked", and answers "free" to both. That is the same class
 *     of failure as the bug this replaces — a confident claim the data does not
 *     support — so absent is modelled as its own state and never as free.
 *  2. Assuming one holder. `loan_collaterals` is unique on
 *     `(loan_id, collateral_id)`, so two active holders is a legitimate state.
 *     `active_loans[0]` would render one of two and hide the other, on the
 *     screen whose job is spotting exactly that.
 *  3. Forgetting to exclude the loan on screen. `GET /loans/{id}/collaterals`
 *     includes the viewed loan in `active_loans` when it is itself active — the
 *     field answers "who holds this", not "who else". A picker that skips the
 *     exclusion reports every collateral already on the loan being edited as
 *     locked, and the user cannot keep their own collateral.
 */

import type { ActiveLoanRef } from "@/types/collateral";

export type CollateralLock =
  /** The server was asked and named no active holder (beyond any exclusion). */
  | { state: "free"; holders: readonly [] }
  /** One or more active loans hold this, excluding any `exceptLoanId`. */
  | { state: "held"; holders: readonly [ActiveLoanRef, ...ActiveLoanRef[]] }
  /**
   * `active_loans` was not present on the payload. Not the same as free: the
   * question was never asked. Callers should fail safe — show it as
   * indeterminate rather than offering it as available.
   */
  | { state: "unknown"; holders: readonly [] };

const FREE: CollateralLock = { state: "free", holders: [] };
const UNKNOWN: CollateralLock = { state: "unknown", holders: [] };

/** Anything carrying the field. Deliberately structural — rows, pickers, forms. */
export interface HasActiveLoans {
  active_loans?: ActiveLoanRef[] | null;
}

export interface CollateralLockOptions {
  /**
   * The loan currently on screen. Its own hold does not count as a conflict —
   * an edit or restructure form must let the user keep the collateral the loan
   * already has. Null/undefined for screens with no loan context (the
   * collateral listing, the member tab), where every holder counts.
   */
  exceptLoanId?: number | null;
}

/**
 * Lock state for one collateral.
 *
 * Never throws and never guesses: a malformed `active_loans` is reported as
 * `unknown` rather than quietly reduced to free.
 */
export function collateralLock(
  collateral: HasActiveLoans | null | undefined,
  options: CollateralLockOptions = {},
): CollateralLock {
  const raw = collateral?.active_loans;
  if (raw == null || !Array.isArray(raw)) return UNKNOWN;

  const { exceptLoanId } = options;
  const holders = raw.filter(
    (loan): loan is ActiveLoanRef =>
      Boolean(loan) &&
      typeof loan.id === "number" &&
      (exceptLoanId == null || loan.id !== exceptLoanId),
  );

  return holders.length > 0
    ? { state: "held", holders: holders as [ActiveLoanRef, ...ActiveLoanRef[]] }
    : FREE;
}

/** True when this collateral must not be offered — held, or not confirmed free. */
export function isLocked(lock: CollateralLock): boolean {
  return lock.state !== "free";
}

/** How a holder is named to a user: its account number, or a last-resort id. */
export function holderLabel(loan: ActiveLoanRef): string {
  return loan.loan_account_number ?? `#${loan.id}`;
}

/**
 * Badge text for a lock, or null when there is nothing to say.
 *
 * Plural is spelled out rather than truncated to the first holder: two active
 * holders is the state an operator most needs to see, and "Tagged to loan
 * LN-0001" while a second loan also holds it would be a smaller lie than the
 * old bug but the same kind.
 */
export function lockLabel(lock: CollateralLock): string | null {
  switch (lock.state) {
    case "free":
      return null;
    case "unknown":
      return "Lock state unknown";
    case "held":
      return lock.holders.length === 1
        ? `Tagged to loan ${holderLabel(lock.holders[0])}`
        : `Tagged to ${lock.holders.length} active loans`;
  }
}

/** Every holder named, for tooltips and the "why is this disabled" copy. */
export function holdersSentence(lock: CollateralLock): string | null {
  if (lock.state === "unknown") {
    return "This collateral's lock state could not be confirmed, so it cannot be attached.";
  }
  if (lock.state === "free") return null;
  const names = lock.holders.map(holderLabel).join(", ");
  return lock.holders.length === 1
    ? `Currently pledged to active loan ${names}.`
    : `Currently pledged to active loans ${names}.`;
}
