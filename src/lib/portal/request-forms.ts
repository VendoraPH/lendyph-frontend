import type { NewRequestBody } from "./portal-api";
import type { RequestType } from "./types";

/**
 * The new-request dialog's three forms and the bodies they send (portal
 * design §6). The browser checks only that a field is filled in and that an
 * amount is written as pesos and centavos; every rule that needs a figure
 * (the withdrawable amount, the minimum opening deposit) is the server's, and
 * its 422 is shown in its own words.
 */

export interface WithdrawalForm {
  account_id: string;
  amount: string;
  method: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  gcash_number: string;
}

export interface OpeningForm {
  product_id: string;
  initial_deposit: string;
  terms_accepted: boolean;
}

/** Field → the member's new value, for the fields they changed. */
export type ProfileForm = Record<string, string>;

export const EMPTY_WITHDRAWAL: WithdrawalForm = {
  account_id: "",
  amount: "",
  method: "",
  bank_name: "",
  account_name: "",
  account_number: "",
  gcash_number: "",
};

export const EMPTY_OPENING: OpeningForm = { product_id: "", initial_deposit: "", terms_accepted: false };

/** An amount as typed ("1,500.50", "₱ 200") reduced to the text the server reads ("1500.50"); null when it isn't one. */
export function amountText(raw: string): string | null {
  const text = raw.replace(/[₱,\s]/g, "");
  return /^\d{1,12}(\.\d{1,2})?$/.test(text) ? text : null;
}

export type FormErrors = Record<string, string>;

const required = (errors: FormErrors, field: string, value: string, message: string) => {
  if (value.trim() === "") errors[field] = message;
};

export function withdrawalErrors(form: WithdrawalForm): FormErrors {
  const errors: FormErrors = {};
  required(errors, "account_id", form.account_id, "Choose the savings account to withdraw from.");
  if (amountText(form.amount) === null) errors.amount = "Enter the amount in pesos, like 1500 or 1500.50.";
  required(errors, "method", form.method, "Choose how you'd like to receive the money.");
  if (form.method === "bank_transfer") {
    required(errors, "bank_name", form.bank_name, "Enter the bank's name.");
    required(errors, "account_name", form.account_name, "Enter the name on the bank account.");
    required(errors, "account_number", form.account_number, "Enter the bank account number.");
  }
  if (form.method === "gcash") required(errors, "gcash_number", form.gcash_number, "Enter the GCash number.");
  return errors;
}

export function openingErrors(form: OpeningForm): FormErrors {
  const errors: FormErrors = {};
  required(errors, "product_id", form.product_id, "Choose the savings product.");
  if (amountText(form.initial_deposit) === null) errors.initial_deposit = "Enter the opening deposit in pesos, like 500 or 500.00.";
  if (!form.terms_accepted) errors.terms_accepted = "Please confirm that you'll bring the opening deposit to your branch.";
  return errors;
}

/** Only the fields the member actually filled in are sent. */
export function profileChanges(form: ProfileForm): ProfileForm {
  return Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== "").map(([k, v]) => [k, v.trim()]));
}

export function profileErrors(form: ProfileForm): FormErrors {
  return Object.keys(profileChanges(form)).length === 0 ? { form: "Fill in at least one change." } : {};
}

export function withdrawalBody(form: WithdrawalForm, remarks: string): NewRequestBody {
  const details: Record<string, string | number> = {
    account_id: Number(form.account_id),
    amount: amountText(form.amount) ?? form.amount,
    method: form.method,
  };
  if (form.method === "bank_transfer") {
    details.bank_name = form.bank_name.trim();
    details.account_name = form.account_name.trim();
    details.account_number = form.account_number.trim();
  }
  if (form.method === "gcash") details.gcash_number = form.gcash_number.trim();
  return withRemarks({ type: "savings_withdrawal", details }, remarks);
}

export function openingBody(form: OpeningForm, remarks: string): NewRequestBody {
  return withRemarks(
    {
      type: "savings_opening",
      details: {
        product_id: Number(form.product_id),
        initial_deposit: amountText(form.initial_deposit) ?? form.initial_deposit,
        terms_accepted: form.terms_accepted,
      },
    },
    remarks,
  );
}

export function profileBody(form: ProfileForm, remarks: string): NewRequestBody {
  return withRemarks({ type: "profile_update", details: profileChanges(form) }, remarks);
}

function withRemarks(body: NewRequestBody, remarks: string): NewRequestBody {
  return remarks.trim() ? { ...body, remarks: remarks.trim() } : body;
}

/** The request types in the order the dialog offers them. */
export const REQUEST_TYPES: readonly RequestType[] = ["savings_withdrawal", "savings_opening", "profile_update"];
