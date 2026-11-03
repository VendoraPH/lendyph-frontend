/**
 * The deposit, withdrawal and transfer forms: their fields while editing and
 * how they become the API payload. The account rules come from
 * `savings-rules`; the server checks them all again on the locked row.
 */
import { parseMoneyInput } from "@/lib/money-input";
import type {
  SavingsAccount,
  SavingsDepositPayload,
  SavingsPaymentMethod,
  SavingsTransferPayload,
} from "@/types/savings";
import { validateDeposit, validateTransfer, validateWithdrawal } from "./savings-rules";

export type MovementMode = "deposit" | "withdrawal";

export interface MovementForm {
  account_id: number | null;
  amount: string;
  /** `YYYY-MM-DD`. */
  transaction_date: string;
  payment_method: SavingsPaymentMethod;
  reference_number: string;
  remarks: string;
}

export interface TransferForm {
  from_account_id: number | null;
  to_account_id: number | null;
  amount: string;
  transaction_date: string;
  reference_number: string;
  remarks: string;
}

export function emptyMovementForm(today: string, accountId: number | null = null): MovementForm {
  return {
    account_id: accountId,
    amount: "",
    transaction_date: today,
    payment_method: "cash",
    reference_number: "",
    remarks: "",
  };
}

export function emptyTransferForm(today: string, fromId: number | null = null): TransferForm {
  return {
    from_account_id: fromId,
    to_account_id: null,
    amount: "",
    transaction_date: today,
    reference_number: "",
    remarks: "",
  };
}

export type FormCheck<P> = { ok: true; payload: P } | { ok: false; fields: string[]; message?: string };

type AccountForForm = Pick<SavingsAccount, "id" | "status" | "available_balance" | "product">;

const optional = (form: { reference_number: string; remarks: string }) => ({
  ...(form.reference_number.trim() ? { reference_number: form.reference_number.trim() } : {}),
  ...(form.remarks.trim() ? { remarks: form.remarks.trim() } : {}),
});

/** Missing fields first (all at once), then the date, then the amount's own message. */
function common(
  amountText: string,
  date: string,
  today: string,
  label: string,
  fields: string[],
): { amount: number | null; message?: string } {
  let message: string | undefined;
  if (!date) fields.push("Transaction date");
  else if (date > today) {
    fields.push("Transaction date");
    message = "The transaction date can't be in the future.";
  }
  const parsed = parseMoneyInput(amountText, { label });
  if (!parsed.ok) {
    fields.push(label);
    if (amountText.trim()) message ??= parsed.message;
    return { amount: null, message };
  }
  return { amount: parsed.amount, message };
}

export function movementPayload(
  mode: MovementMode,
  form: MovementForm,
  account: AccountForForm | null,
  today: string,
): FormCheck<SavingsDepositPayload> {
  const fields: string[] = [];
  if (form.account_id === null || !account) fields.push("Account");
  const label = mode === "deposit" ? "Deposit amount" : "Withdrawal amount";
  const { amount, message } = common(form.amount, form.transaction_date, today, label, fields);
  if (fields.length > 0 || amount === null || !account) return { ok: false, fields, message };

  const rule = mode === "deposit" ? validateDeposit(account, amount) : validateWithdrawal(account, amount);
  if (!rule.ok) return { ok: false, fields: [], message: rule.message };

  return {
    ok: true,
    payload: {
      account_id: account.id,
      amount,
      transaction_date: form.transaction_date,
      payment_method: form.payment_method,
      ...optional(form),
    },
  };
}

export function transferPayload(
  form: TransferForm,
  from: AccountForForm | null,
  to: AccountForForm | null,
  today: string,
): FormCheck<SavingsTransferPayload> {
  const fields: string[] = [];
  if (form.from_account_id === null || !from) fields.push("Source account");
  if (form.to_account_id === null || !to) fields.push("Destination account");
  const { amount, message } = common(form.amount, form.transaction_date, today, "Transfer amount", fields);
  if (fields.length > 0 || amount === null || !from || !to) return { ok: false, fields, message };

  const rule = validateTransfer(from, to, amount);
  if (!rule.ok) return { ok: false, fields: [], message: rule.message };

  return {
    ok: true,
    payload: {
      from_account_id: from.id,
      to_account_id: to.id,
      amount,
      transaction_date: form.transaction_date,
      ...optional(form),
    },
  };
}
