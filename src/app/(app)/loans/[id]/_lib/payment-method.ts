// How a payment was received, as Record Payment asks for it and the API stores
// it. The stored method decides the account the payment's journal posts to and
// what the statement prints. Dependency-free, so it runs under `tsx --test`.

import type { CreateRepaymentData } from "@/types/repayment";

/** What `POST /loans/{id}/repayments` accepts as `method`. */
export type RecordPaymentMethod = "cash" | "gcash" | "maya" | "bank_transfer" | "online";

export const DEFAULT_PAYMENT_METHOD: RecordPaymentMethod = "cash";

export const PAYMENT_METHOD_OPTIONS: readonly { value: RecordPaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "online", label: "Online" },
];

export function paymentMethodLabel(method: RecordPaymentMethod): string {
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

/** The select's new value, or the current method for anything it can't offer. */
export function readPaymentMethod(value: unknown, current: RecordPaymentMethod): RecordPaymentMethod {
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.value ?? current;
}

/** Why the reference number can't be left as it is: the API's rule, said before posting. */
export function paymentReferenceError(method: RecordPaymentMethod, reference: string): string | null {
  return method !== "cash" && reference.trim() === ""
    ? `Enter the reference number for this ${paymentMethodLabel(method)} payment.`
    : null;
}

export interface PaymentMethodFields {
  method: RecordPaymentMethod;
  reference_number?: string;
}

/** The method fields a payment sends; nothing for a reference left blank. */
export function paymentMethodFields(method: RecordPaymentMethod, reference: string): PaymentMethodFields {
  const typed = reference.trim();
  return typed === "" ? { method } : { method, reference_number: typed };
}

/** What Record Payment posts. */
export type RecordPaymentPayload = CreateRepaymentData & PaymentMethodFields;
