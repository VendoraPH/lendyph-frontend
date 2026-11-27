/**
 * What the savings documents in the catalog read, as one payload per
 * document (`{account, member, product, settings, quote, closing}`,
 * `{transaction, account}`, `{deposit, quote}`) for the templates in
 * `templates/savings-*.ts`.
 *
 * The record itself must be read, or the payload is null and the template
 * prints a blank form. Everything else is optional and fails soft, and a read
 * under another permission is skipped when the user lacks it:
 * - the member record (birthdate, address, contact details) needs
 *   `borrowers:view`; the server also hides another branch's member (the
 *   round fz rule);
 * - the closing and pre-termination quotes need `savings:close`.
 */

import { todayISO } from "@/lib/format";
import { borrowerService, savingsService, timeDepositService } from "@/services";
import { useAuthStore } from "@/store";
import type { Permission } from "@/types";

export type Can = (permission: Permission) => boolean;

const storeCan: Can = (permission) => useAuthStore.getState().hasPermission(permission);

/** A settled read's value, or null. */
function valueOf<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

const skip = Promise.resolve(null);

export interface AccountParts {
  member?: boolean;
  product?: boolean;
  settings?: boolean;
  /** The closing quote for an open account, or the closing payout row for a closed one. */
  closing?: boolean;
}

export async function fetchSavingsAccountPayload(
  accountId: number,
  parts: AccountParts,
  can: Can = storeCan,
): Promise<Record<string, unknown> | null> {
  const account = await savingsService.account(accountId).catch(() => null);
  if (!account) return null;
  const closed = account.status === "closed";

  const [member, products, settings, quote, closing] = await Promise.allSettled([
    parts.member && can("borrowers:view") ? borrowerService.detail(account.borrower_id) : skip,
    parts.product ? savingsService.products() : skip,
    parts.settings ? savingsService.settings() : skip,
    parts.closing && !closed && can("savings:close") ? savingsService.closingQuote(accountId, todayISO()) : skip,
    parts.closing && closed ? savingsService.accountTransactions(accountId, { type: "closing", per_page: 1 }) : skip,
  ]);

  return {
    account,
    member: valueOf(member),
    product: valueOf(products)?.find((p) => p.id === account.product?.id) ?? null,
    settings: valueOf(settings),
    quote: valueOf(quote),
    closing: valueOf(closing)?.data?.[0] ?? null,
  };
}

export async function fetchSavingsWithdrawalPayload(transactionId: number): Promise<Record<string, unknown> | null> {
  const transaction = await savingsService.transaction(transactionId).catch(() => null);
  if (!transaction) return null;
  const account = await savingsService.account(transaction.account_id).catch(() => null);
  return { transaction, account };
}

export async function fetchTimeDepositPayload(
  depositId: number,
  withQuote: boolean,
  can: Can = storeCan,
): Promise<Record<string, unknown> | null> {
  const deposit = await timeDepositService.get(depositId).catch(() => null);
  if (!deposit) return null;
  // Only a placement still running can be terminated early.
  const quote =
    withQuote && deposit.status === "active" && can("savings:close")
      ? await timeDepositService.preterminationQuote(depositId, todayISO()).catch(() => null)
      : null;
  return { deposit, quote };
}
