/**
 * The open-account form: its fields while editing and how they become the
 * API payload. The product's rules (active, minimum initial deposit) come
 * from `savings-rules`; the server checks them all again.
 */
import { parseMoneyInput } from "@/lib/money-input";
import type { OpenSavingsAccountPayload, SavingsPaymentMethod, SavingsProduct } from "@/types/savings";
import { validateOpening } from "../../../_lib/savings-rules";

export interface OpenAccountForm {
  borrower_id: number | null;
  savings_product_id: number | null;
  /** `YYYY-MM-DD`. */
  opened_at: string;
  initial_deposit: string;
  payment_method: SavingsPaymentMethod;
  reference_number: string;
  remarks: string;
}

export function emptyOpenAccountForm(today: string): OpenAccountForm {
  return {
    borrower_id: null,
    savings_product_id: null,
    opened_at: today,
    initial_deposit: "",
    payment_method: "cash",
    reference_number: "",
    remarks: "",
  };
}

export type OpenAccountCheck =
  | { ok: true; payload: OpenSavingsAccountPayload }
  | { ok: false; fields: string[]; message?: string };

type ProductForOpening = Pick<SavingsProduct, "status" | "min_initial_deposit">;

/**
 * Validate the form against the chosen product and build the payload.
 * `fields` names everything missing at once; `message` explains a rule.
 */
export function openAccountPayload(
  form: OpenAccountForm,
  product: ProductForOpening | null,
  today: string,
): OpenAccountCheck {
  const fields: string[] = [];
  let message: string | undefined;

  if (form.borrower_id === null) fields.push("Member");
  if (form.savings_product_id === null || !product) fields.push("Savings product");
  if (!form.opened_at) fields.push("Date opened");
  else if (form.opened_at > today) {
    fields.push("Date opened");
    message ??= "The opening date can't be in the future.";
  }

  const amount = parseMoneyInput(form.initial_deposit, { label: "Initial deposit", allowZero: true });
  if (!amount.ok) {
    fields.push("Initial deposit");
    if (form.initial_deposit.trim()) message ??= amount.message;
  }

  if (fields.length > 0) return { ok: false, fields, message };
  if (!amount.ok || !product || form.borrower_id === null || form.savings_product_id === null) {
    return { ok: false, fields: ["Initial deposit"] };
  }

  const rule = validateOpening(product, amount.amount);
  if (!rule.ok) return { ok: false, fields: [], message: rule.message };

  return {
    ok: true,
    payload: {
      borrower_id: form.borrower_id,
      savings_product_id: form.savings_product_id,
      opened_at: form.opened_at,
      initial_deposit: amount.amount,
      payment_method: form.payment_method,
      ...(form.reference_number.trim() ? { reference_number: form.reference_number.trim() } : {}),
      ...(form.remarks.trim() ? { remarks: form.remarks.trim() } : {}),
    },
  };
}
