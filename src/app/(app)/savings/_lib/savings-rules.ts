/**
 * Savings business rules the forms check before asking the server.
 *
 * These are for the user's benefit only: they say what is wrong before the
 * request is sent. The server enforces every one of them again, against the
 * locked row, and its answer is the one that counts.
 */
import { formatCurrency } from "@/lib/format";
import type { Money, SavingsAccount, SavingsProduct } from "@/types/savings";

export type RuleResult = { ok: true } | { ok: false; message: string };

const OK: RuleResult = { ok: true };
const fail = (message: string): RuleResult => ({ ok: false, message });

/** A decimal string or number as centavos, so comparisons don't drift. */
export function toCentavos(value: Money | null | undefined): number {
  const n = typeof value === "number" ? value : Number.parseFloat(value ?? "");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const peso = (centavos: number) => formatCurrency(centavos / 100);

type AccountForRules = Pick<SavingsAccount, "status" | "available_balance" | "product">;

/** Why this account can't take a deposit, if it can't. */
export function canDeposit(account: AccountForRules): RuleResult {
  if (account.status === "closed") return fail("This account is closed.");
  if (account.status === "frozen") return fail("This account is frozen. Unfreeze it first.");
  if (!account.product.allow_deposits) return fail("This product does not accept deposits.");
  return OK;
}

/** Why this account can't make a withdrawal at all, if it can't. */
export function canWithdraw(account: AccountForRules): RuleResult {
  if (account.status === "closed") return fail("This account is closed.");
  if (account.status === "frozen") return fail("This account is frozen. Unfreeze it first.");
  if (account.status === "dormant") return fail("This account is dormant. Reactivate it first.");
  if (!account.product.allow_withdrawals) return fail("This product does not allow withdrawals.");
  return OK;
}

/**
 * The most that can come out without breaking the maintaining balance, in
 * centavos, never negative. A per-transaction cap on the product lowers it.
 */
export function withdrawableCentavos(account: AccountForRules): number {
  const headroom =
    toCentavos(account.available_balance) - toCentavos(account.product.min_maintaining_balance);
  const cap = account.product.max_withdrawal_amount;
  const limited = cap === null || cap === undefined ? headroom : Math.min(headroom, toCentavos(cap));
  return Math.max(0, limited);
}

export function validateDeposit(account: AccountForRules, amount: number): RuleResult {
  const allowed = canDeposit(account);
  if (!allowed.ok) return allowed;
  if (!(amount > 0)) return fail("Deposit amount must be greater than 0.");
  return OK;
}

export function validateWithdrawal(account: AccountForRules, amount: number): RuleResult {
  const allowed = canWithdraw(account);
  if (!allowed.ok) return allowed;
  if (!(amount > 0)) return fail("Withdrawal amount must be greater than 0.");
  const want = Math.round(amount * 100);
  const cap = account.product.max_withdrawal_amount;
  if (cap !== null && cap !== undefined && want > toCentavos(cap)) {
    return fail(`This product allows at most ${peso(toCentavos(cap))} per withdrawal.`);
  }
  if (want > toCentavos(account.available_balance)) {
    return fail(`Insufficient funds. Available balance is ${peso(toCentavos(account.available_balance))}.`);
  }
  if (want > withdrawableCentavos(account)) {
    return fail(
      `This would leave less than the ${peso(toCentavos(account.product.min_maintaining_balance))} maintaining balance. ` +
        `At most ${peso(withdrawableCentavos(account))} can be withdrawn.`,
    );
  }
  return OK;
}

type AccountRef = AccountForRules & Pick<SavingsAccount, "id">;

export function validateTransfer(from: AccountRef, to: AccountRef, amount: number): RuleResult {
  if (from.id === to.id) return fail("Choose two different accounts.");
  const out = validateWithdrawal(from, amount);
  if (!out.ok) return fail(`Source account: ${out.message}`);
  const into = canDeposit(to);
  if (!into.ok) return fail(`Destination account: ${into.message}`);
  return OK;
}

type ProductForOpening = Pick<SavingsProduct, "status" | "min_initial_deposit">;

export function validateOpening(product: ProductForOpening, initialDeposit: number): RuleResult {
  if (product.status !== "active") return fail("This product is inactive. Choose an active product.");
  if (initialDeposit < 0) return fail("Initial deposit can't be negative.");
  const min = toCentavos(product.min_initial_deposit);
  if (Math.round(initialDeposit * 100) < min) {
    return fail(`This product needs an initial deposit of at least ${peso(min)}.`);
  }
  return OK;
}

/** Balance after the movement, in pesos, for the confirm dialog's preview. */
export function projectedBalance(current: Money, amount: number, direction: "in" | "out"): number {
  const delta = Math.round(amount * 100) * (direction === "in" ? 1 : -1);
  return (toCentavos(current) + delta) / 100;
}
