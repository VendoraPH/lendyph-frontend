import { shareCapitalService } from "@/services";
import type { DrainResult } from "@/lib/paginate";
import type { ShareCapitalLedgerEntry } from "@/types";

/**
 * What a screen learns when it asks for a member's share capital balance.
 *
 * A discriminated union rather than a `number`, because the old `Promise<number>`
 * could not express the two answers that actually matter here — and every one
 * of the five callers treats this figure as a hard eligibility number: it caps
 * how much a share-capital collateral is worth, which caps what the member can
 * borrow against it.
 *
 * The two states that used to be indistinguishable from a real balance:
 *
 *  - `incomplete` — the drain gave up with pages outstanding, so the sum is
 *    over part of the ledger. This is NOT "a bit low". A clamped ledger drops
 *    credits and debits alike, so the error has no direction: reproduced
 *    against a stub, one member read ₱40,000 against a true ₱180,000 and
 *    another read ₱100,000 against a true ₱25,000. There is no safe way to
 *    round a partial ledger, which is why this is a refusal and not a caveat.
 *  - `unavailable` — the request failed. The old code returned 0 here, which
 *    is byte-identical to a member who genuinely holds no share capital: a
 *    network blip presented as "this member has no share capital" and failed
 *    the eligibility check on its own, silently, with no error anywhere on
 *    screen.
 *
 * Neither carries a `balance` field. That is the point — there is no number to
 * reach for, so a caller cannot fall back to `?? 0` and re-create the bug.
 */
export type ShareCapitalBalance =
  | {
      status: "ok";
      /** Credits minus debits over the member's WHOLE ledger. */
      balance: number;
      /** How many entries it was summed from. */
      entries: number;
    }
  | {
      status: "incomplete";
      /** Entries actually in hand. */
      shown: number;
      /** `meta.total` — how many exist. Null when the response carried none. */
      total: number | null;
    }
  | { status: "unavailable" };

/**
 * The one label for "we cannot tell you this member's balance".
 *
 * Shared so the five screens read identically. They disagreed before — one
 * showed ₱0.00, one showed a dash, three showed a wrong number — and a member
 * whose balance is unknown on one screen and ₱0.00 on the next is worse than
 * either on its own.
 */
export const SHARE_CAPITAL_UNAVAILABLE_LABEL = "Balance unavailable";

/**
 * One sentence naming what went wrong and what it costs, for a banner, a
 * tooltip or a disabled control's helper text. "Unavailable" on its own tells
 * an operator nothing about whether to wait, retry, or call somebody.
 */
export function shareCapitalUnavailableReason(
  result: ShareCapitalBalance
): string | null {
  switch (result.status) {
    case "ok":
      return null;
    case "incomplete":
      return result.total !== null
        ? `Only ${result.shown} of ${result.total} share capital entries could be read, so the balance would be wrong in either direction.`
        : `Only ${result.shown} share capital entries could be read, so the balance would be wrong in either direction.`;
    case "unavailable":
      // Deliberately member-NEUTRAL ("the balance", not "this member's"): the
      // same sentence is rendered under a singular heading on a member's own
      // record and under a plural one on the collateral listing, where several
      // ledgers may have failed at once.
      return "The share capital ledger could not be loaded, so the balance is unknown — which is not the same as zero.";
  }
}

/** True when `result` carries a balance that may be relied on. */
export function hasShareCapitalBalance(
  result: ShareCapitalBalance
): result is Extract<ShareCapitalBalance, { status: "ok" }> {
  return result.status === "ok";
}

/**
 * Credits minus debits over a drained ledger.
 *
 * Split out from the request so it can be tested without a network, and so the
 * truncation decision is made in exactly one place. Takes the whole
 * `DrainResult`, not `result.rows`, precisely so it cannot be called in a way
 * that ignores `truncated`.
 */
export function toShareCapitalBalance(
  drain: DrainResult<ShareCapitalLedgerEntry>
): ShareCapitalBalance {
  if (drain.truncated) {
    return { status: "incomplete", shown: drain.rows.length, total: drain.total };
  }

  let credits = 0;
  let debits = 0;
  for (const entry of drain.rows) {
    // Defensive coercion — bad/missing amounts shouldn't poison the running
    // total with NaN (which would propagate to "-₱NaN" in the UI).
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount)) continue;
    if (entry.type === "credit") credits += amount;
    else debits += amount;
  }

  const balance = credits - debits;
  // A non-finite total means the arithmetic itself is untrustworthy, so it is
  // reported as unknown rather than coerced to 0 — same reasoning as the
  // failure path.
  return Number.isFinite(balance)
    ? { status: "ok", balance, entries: drain.rows.length }
    : { status: "unavailable" };
}

/**
 * The member's current share capital balance, over their whole ledger.
 *
 * Drained page by page. It used to be one request with `per_page: 9999`, which
 * `ShareCapitalLedgerController::index()` clamps to `min(per_page, 100)`
 * without a word — so for any member past their hundredth entry this returned
 * the sum of a page and presented it as a balance.
 *
 * Callers must handle all three states rather than reach for a number. Every
 * one of them was written against `Promise<number>` and used the result to
 * decide what a member may borrow, so "refuse to decide" is the only correct
 * behaviour when the ledger is short or missing: an eligibility check computed
 * against a partial ledger is not a conservative answer, it is a wrong one.
 */
export async function getShareCapitalBalance(
  borrowerId: number
): Promise<ShareCapitalBalance> {
  try {
    return toShareCapitalBalance(
      await shareCapitalService.ledgerListAll({ borrower_id: borrowerId })
    );
  } catch {
    return { status: "unavailable" };
  }
}
