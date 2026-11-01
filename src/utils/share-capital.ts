import { shareCapitalService } from "@/services";
import type { ShareCapitalLedgerEntry, ShareCapitalMemberPeriod } from "@/types";

/**
 * What a screen learns when it asks for a member's share capital balance.
 *
 * A discriminated union rather than a `number`, because the old `Promise<number>`
 * could not express the answer that actually matters here — and every one
 * of the five callers treats this figure as a hard eligibility number: it caps
 * how much a share-capital collateral is worth, which caps what the member can
 * borrow against it.
 *
 * The balance is the server's (`meta.summary.ending_balance` of
 * `GET /share-capital/ledger?borrower_id=`), never a browser sum.
 * `unavailable` covers a failed or skipped request and a missing or unreadable
 * figure. The old code returned 0 there, which is byte-identical to a member
 * who genuinely holds no share capital: a network blip presented as "this
 * member has no share capital" and failed the eligibility check on its own.
 *
 * It carries no `balance` field. That is the point — there is no number to
 * reach for, so a caller cannot fall back to `?? 0` and re-create the bug.
 */
export type ShareCapitalBalance =
  | {
      status: "ok";
      /** The server's balance over the member's WHOLE ledger. */
      balance: number;
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
    case "unavailable":
      // Deliberately member-NEUTRAL ("the balance", not "this member's"): the
      // same sentence sits under a banner heading on one screen and beside a
      // form control on another, and each of those names the member itself.
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
 * An entry's `debit` and `credit`, each coerced to a finite number.
 *
 * Defensive coercion — a bad or missing column counts as 0 rather than
 * poisoning a running total with NaN (which would propagate to "-₱NaN" in the
 * UI). Shared by every screen that sums a ledger, so the rule lives in one
 * place.
 */
export function ledgerAmounts(
  entry: Pick<ShareCapitalLedgerEntry, "debit" | "credit">
): { debit: number; credit: number } {
  const debit = Number(entry.debit);
  const credit = Number(entry.credit);
  return {
    debit: Number.isFinite(debit) ? debit : 0,
    credit: Number.isFinite(credit) ? credit : 0,
  };
}

/**
 * The server's balance from a member's `meta.summary`, as the result type.
 *
 * Split out from the request so it can be tested without a network. A missing
 * summary or an unreadable `ending_balance` is `unavailable`, never 0.
 */
export function toShareCapitalBalance(
  summary: ShareCapitalMemberPeriod | null | undefined
): ShareCapitalBalance {
  const raw: unknown = summary?.ending_balance;
  const balance = typeof raw === "number" || typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isFinite(balance) ? { status: "ok", balance } : { status: "unavailable" };
}

/**
 * The member's current share capital balance, over their whole ledger, as the
 * server states it: `meta.summary.ending_balance` of
 * `GET /share-capital/ledger?borrower_id=` with no date range. One row is
 * asked for because only the summary is read; nothing is added up here.
 *
 * Callers must handle both states rather than reach for a number: they use the
 * result to decide what a share-capital collateral is worth, so "refuse to
 * decide" is the only correct behaviour when the balance is unknown.
 *
 * `canRead` is the caller's `share_capital:view`. The ledger answers 403
 * without it, so the request is not made and the result is `unavailable`,
 * exactly what a refused one produces.
 */
export async function getShareCapitalBalance(
  borrowerId: number,
  canRead = true
): Promise<ShareCapitalBalance> {
  if (!canRead) return { status: "unavailable" };
  try {
    const res = await shareCapitalService.ledgerList({ borrower_id: borrowerId, per_page: 1 });
    const meta = (res as { meta?: { summary?: ShareCapitalMemberPeriod } } | undefined)?.meta;
    return toShareCapitalBalance(meta?.summary);
  } catch {
    return { status: "unavailable" };
  }
}
