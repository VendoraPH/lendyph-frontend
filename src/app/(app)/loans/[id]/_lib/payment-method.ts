// How a payment was received, as Record Payment asks for it and the API stores
// it. The stored method decides the account the payment's journal posts to and
// what the statement prints. Dependency-free, so it runs under `tsx --test`.

import { PAYMENT_METHOD_OPTIONS, type RecordPaymentMethod } from "@/constants/payment-methods";
import {
  paymentMethodFields,
  paymentReferenceError,
  referenceAfterMethodChange,
  type PaymentMethodFields,
} from "@/lib/payment-reference";
import type { ExtensionInterestOption } from "@/types/loan";
import type { CreateRepaymentData } from "@/types/repayment";

export { PAYMENT_METHOD_OPTIONS, type RecordPaymentMethod };
// The reference rules are shared with every screen that moves money
// (`@/lib/payment-reference`); Record Payment keeps reading them from here.
export { paymentMethodFields, paymentReferenceError, referenceAfterMethodChange, type PaymentMethodFields };

export const DEFAULT_PAYMENT_METHOD: RecordPaymentMethod = "cash";

export function paymentMethodLabel(method: RecordPaymentMethod): string {
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

/** The select's new value, or the current method for anything it can't offer. */
export function readPaymentMethod(value: unknown, current: RecordPaymentMethod): RecordPaymentMethod {
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.value ?? current;
}

/**
 * The method fields an extension sends. Only "pay" collects money, so only it
 * says how; "defer" sends neither.
 */
export function extensionMethodFields(
  option: ExtensionInterestOption,
  method: RecordPaymentMethod,
  reference: string,
): Partial<PaymentMethodFields> {
  return option === "pay" ? paymentMethodFields(method, reference) : {};
}

/** Why the extension's reference can't be left as it is; nothing on "defer". */
export function extensionReferenceError(
  option: ExtensionInterestOption,
  method: RecordPaymentMethod,
  reference: string,
): string | null {
  return option === "pay" ? paymentReferenceError(method, reference, "extension") : null;
}

/** What Record Payment posts. */
export type RecordPaymentPayload = CreateRepaymentData & PaymentMethodFields;
