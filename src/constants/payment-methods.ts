// How a payment was received, as the API stores it, and its name in words. The
// loan page's Record Payment offers the selectable ones; printables name any.

/** What `POST /loans/{id}/repayments` accepts as `method`. */
export type RecordPaymentMethod = "cash" | "gcash" | "maya" | "bank_transfer" | "online";

export const PAYMENT_METHOD_OPTIONS: readonly { value: RecordPaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "online", label: "Online" },
];

/** Methods the server records that nobody picks by hand. */
const RECORDED_ONLY_METHODS: Readonly<Record<string, string>> = {
  auto_pay: "Auto-Pay",
};

/** A stored method in words ("GCash", "Auto-Pay"), or null when it isn't one we know. */
export function knownPaymentMethodName(method: unknown): string | null {
  if (typeof method !== "string") return null;
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? RECORDED_ONLY_METHODS[method] ?? null;
}
