/**
 * The "Extend loan?" prompt on an upon-maturity partial payment: three
 * buttons, one outcome each. Closing the prompt any other way (Escape, a
 * click outside) is Cancel.
 *
 * Pure, so it runs under `tsx --test`.
 */
export type PartialExtendChoice = "cancel" | "record" | "extend";

export interface PartialExtendOutcome {
  /** Record the payment the cashier entered. */
  recordPayment: boolean;
  /** Extend the loan after recording it. */
  extend: boolean;
}

export const PARTIAL_EXTEND_LABELS: Record<PartialExtendChoice, string> = {
  cancel: "Cancel",
  record: "Record partial payment",
  extend: "Yes, extend",
};

export function partialExtendOutcome(choice: PartialExtendChoice): PartialExtendOutcome {
  switch (choice) {
    case "cancel":
      return { recordPayment: false, extend: false };
    case "record":
      return { recordPayment: true, extend: false };
    case "extend":
      return { recordPayment: true, extend: true };
  }
}
