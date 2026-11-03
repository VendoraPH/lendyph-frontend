import type { SavingsPaymentMethod } from "@/types/savings";

/** How money came in or went out, for deposits, withdrawals and openings. */
export const PAYMENT_METHOD_OPTIONS: { value: SavingsPaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "gcash", label: "GCash" },
  { value: "other", label: "Other" },
];

export function paymentMethodLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
