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

/** The prompt closing on its own (Escape, outside click) is Cancel; opening needs no choice. */
export function partialExtendOnOpenChange(open: boolean): PartialExtendChoice | null {
  return open ? null : "cancel";
}

/**
 * Runs the choice on the pending payment: Cancel runs nothing, "Record
 * partial payment" only records it, "Yes, extend" records it and extends.
 * Nothing runs when no payment is pending.
 */
export async function dispatchPartialExtend<P>(
  choice: PartialExtendChoice,
  payment: P | null,
  actions: { record: (payment: P) => Promise<unknown>; recordAndExtend: (payment: P) => Promise<unknown> },
): Promise<void> {
  const outcome = partialExtendOutcome(choice);
  if (payment === null || !outcome.recordPayment) return;
  if (outcome.extend) await actions.recordAndExtend(payment);
  else await actions.record(payment);
}
