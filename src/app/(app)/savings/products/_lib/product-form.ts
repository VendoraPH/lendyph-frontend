/**
 * The savings product form: what the fields hold while editing, how a saved
 * product fills them, and how they become the API payload.
 *
 * Amounts and rates stay strings while typed so "1.125" and "500.50" survive
 * exactly; they become numbers only in the payload, after validation.
 */
import { decimalInputValue } from "@/lib/percent";
import { isTooPrecise, parseMoneyInput } from "@/lib/money-input";
import type {
  SavingsInterestMethod,
  SavingsPostingFrequency,
  SavingsProduct,
  SavingsProductPayload,
  SavingsProductStatus,
} from "@/types/savings";

export interface SavingsProductForm {
  code: string;
  name: string;
  description: string;
  product_type: string;
  min_initial_deposit: string;
  min_maintaining_balance: string;
  min_balance_to_earn_interest: string;
  interest_rate: string;
  interest_method: SavingsInterestMethod;
  posting_frequency: SavingsPostingFrequency;
  allow_deposits: boolean;
  allow_withdrawals: boolean;
  allow_multiple_accounts: boolean;
  /** Blank = no cap. */
  max_withdrawal_amount: string;
  status: SavingsProductStatus;
}

export const EMPTY_SAVINGS_PRODUCT_FORM: SavingsProductForm = {
  code: "",
  name: "",
  description: "",
  product_type: "Regular",
  min_initial_deposit: "0",
  min_maintaining_balance: "0",
  min_balance_to_earn_interest: "0",
  interest_rate: "",
  interest_method: "daily_balance",
  posting_frequency: "monthly",
  allow_deposits: true,
  allow_withdrawals: true,
  allow_multiple_accounts: false,
  max_withdrawal_amount: "",
  status: "active",
};

export const POSTING_FREQUENCY_OPTIONS: { value: SavingsPostingFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-annual" },
  { value: "annual", label: "Annual" },
];

export const INTEREST_METHOD_OPTIONS: { value: SavingsInterestMethod; label: string }[] = [
  { value: "daily_balance", label: "Daily balance" },
];

export function postingFrequencyLabel(value: string): string {
  return POSTING_FREQUENCY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** A saved product as the form's fields, exactly (no rounding). */
export function productToForm(p: SavingsProduct): SavingsProductForm {
  const money = (v: unknown) => decimalInputValue(v) || "0";
  return {
    code: p.code ?? "",
    name: p.name ?? "",
    description: p.description ?? "",
    product_type: p.product_type ?? "",
    min_initial_deposit: money(p.min_initial_deposit),
    min_maintaining_balance: money(p.min_maintaining_balance),
    min_balance_to_earn_interest: money(p.min_balance_to_earn_interest),
    interest_rate: decimalInputValue(p.interest_rate),
    interest_method: p.interest_method ?? "daily_balance",
    posting_frequency: p.posting_frequency ?? "monthly",
    allow_deposits: Boolean(p.allow_deposits),
    allow_withdrawals: Boolean(p.allow_withdrawals),
    allow_multiple_accounts: Boolean(p.allow_multiple_accounts),
    max_withdrawal_amount:
      p.max_withdrawal_amount === null || p.max_withdrawal_amount === undefined
        ? ""
        : decimalInputValue(p.max_withdrawal_amount),
    status: p.status ?? "active",
  };
}

export type FormCheck =
  | { ok: true; payload: SavingsProductPayload }
  | { ok: false; fields: string[]; message?: string };

const RATE = /^\d+(?:\.\d{1,6})?$/;

/**
 * Validate the form and build the payload. `fields` names every field that
 * needs fixing (for `notifyValidation`); `message` is set when one rule
 * needs explaining beyond "required".
 */
export function formToPayload(
  form: SavingsProductForm,
  /**
   * Whether the user holds `savings:settings`. Without it the interest fields
   * are neither checked nor sent: the server keeps the product's current
   * values (or its defaults, on create) instead of refusing the save.
   */
  canSetRates = true,
): FormCheck {
  const fields: string[] = [];
  let message: string | undefined;

  if (!form.code.trim()) fields.push("Product code");
  if (!form.name.trim()) fields.push("Product name");
  if (!form.product_type.trim()) fields.push("Product type");

  const money = (raw: string, label: string) => {
    const r = parseMoneyInput(raw, { label, allowZero: true });
    if (!r.ok) {
      fields.push(label);
      if (isTooPrecise(raw)) message ??= r.message;
      return 0;
    }
    return r.amount;
  };

  const minInitial = money(form.min_initial_deposit, "Minimum initial deposit");
  const maintaining = money(form.min_maintaining_balance, "Minimum maintaining balance");
  const earn = money(form.min_balance_to_earn_interest, "Minimum balance to earn interest");

  let cap: number | null = null;
  if (form.max_withdrawal_amount.trim()) {
    const r = parseMoneyInput(form.max_withdrawal_amount, { label: "Maximum withdrawal" });
    if (r.ok) cap = r.amount;
    else {
      fields.push("Maximum withdrawal");
      message ??= r.message;
    }
  }

  const rate = form.interest_rate.trim();
  if (canSetRates && (!RATE.test(rate) || Number(rate) > 100)) {
    fields.push("Interest rate");
    if (rate) message ??= "Interest rate must be a percentage from 0 to 100, up to 6 decimals.";
  }

  if (fields.length > 0) return { ok: false, fields, message };

  return {
    ok: true,
    payload: {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      product_type: form.product_type.trim(),
      min_initial_deposit: minInitial,
      min_maintaining_balance: maintaining,
      min_balance_to_earn_interest: earn,
      ...(canSetRates
        ? {
            interest_rate: Number(rate),
            interest_method: form.interest_method,
            posting_frequency: form.posting_frequency,
          }
        : {}),
      allow_deposits: form.allow_deposits,
      allow_withdrawals: form.allow_withdrawals,
      allow_multiple_accounts: form.allow_multiple_accounts,
      max_withdrawal_amount: cap,
      status: form.status,
    },
  };
}
