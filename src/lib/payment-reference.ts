// How money is received or paid out, as each screen asks for it and the API
// stores it: a method and its reference number. The stored method decides the
// account the journal posts to. Record Payment, the release, an extension on
// "pay", share capital entries and auto-credit all send the same two fields.
// Dependency-free, so it runs under `tsx --test`.

import { PAYMENT_METHOD_OPTIONS, type RecordPaymentMethod } from "@/constants/payment-methods";

/** What a reference is asked for, so the reason a blank one can't go reads right on each screen. */
export type PaymentReferenceSubject =
  | "payment"
  | "release"
  | "restructure_collection"
  | "extension"
  | "share_capital";

function methodName(method: string): string {
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

/**
 * The reference once the method changes: cleared, since it was typed for the old
 * method and must not stay on money moved another way. Picking the same method
 * again keeps it.
 */
export function referenceAfterMethodChange<M extends string>(current: M, next: M, reference: string): string {
  return next === current ? reference : "";
}

/** Why the reference number can't be left as it is: the API's rule, said before posting. */
export function paymentReferenceError(
  method: RecordPaymentMethod,
  reference: string,
  subject: PaymentReferenceSubject = "payment",
): string | null {
  if (method === "cash" || reference.trim() !== "") return null;
  const name = methodName(method);
  switch (subject) {
    case "release":
      return `Enter the reference number of the ${name} transfer that pays out this loan.`;
    case "restructure_collection":
      return `Enter the reference number for this ${name} collection of the restructure's deductions.`;
    case "extension":
      return `Enter the reference number for this ${name} payment collected to extend the loan.`;
    case "share_capital":
      return `Enter the reference number for this ${name} share capital entry.`;
    default:
      return `Enter the reference number for this ${name} payment.`;
  }
}

export interface PaymentMethodFields<M extends string = RecordPaymentMethod> {
  method: M;
  reference_number?: string;
}

/** The method fields a request sends; nothing for a reference left blank. */
export function paymentMethodFields<M extends string>(method: M, reference: string): PaymentMethodFields<M> {
  const typed = reference.trim();
  return typed === "" ? { method } : { method, reference_number: typed };
}

/** The settlement accounts `POST /auto-credit/process` accepts as `method`. */
export type AutoCreditMethod = Exclude<RecordPaymentMethod, "online">;

export const AUTO_CREDIT_DEFAULT_METHOD: AutoCreditMethod = "bank_transfer";

/** Bank first, the run's default, then the rest in the shared list's words. */
export const AUTO_CREDIT_METHOD_OPTIONS: readonly { value: AutoCreditMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank" },
  ...PAYMENT_METHOD_OPTIONS.filter(
    (o): o is { value: AutoCreditMethod; label: string } => o.value !== "online" && o.value !== "bank_transfer",
  ),
];

export function autoCreditMethodLabel(method: AutoCreditMethod): string {
  return AUTO_CREDIT_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

/** The picker's new value, or the current account for anything it can't offer. */
export function readAutoCreditMethod(value: unknown, current: AutoCreditMethod): AutoCreditMethod {
  return AUTO_CREDIT_METHOD_OPTIONS.find((o) => o.value === value)?.value ?? current;
}
