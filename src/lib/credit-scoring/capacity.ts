import { formatCurrency } from "@/lib/format";
import { CAPACITY_ASSESSMENT_LABELS, labelOf } from "./labels";
import { yesNoOrDash } from "./loan-facts";
import type { CreditCapacity } from "@/types/credit-scoring";

export interface CapacityRow {
  label: string;
  value: string;
  note?: string;
}

/** A server peso string with ₱ and two decimals; a missing figure is a dash, never ₱0.00. */
export function pesoOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return formatCurrency(value);
}

/** The capacity block's rows, every figure as the server sent it. */
export function capacityRows(c: CreditCapacity): CapacityRow[] {
  return [
    { label: "Monthly income", value: pesoOrDash(c.monthly_income) },
    { label: "Household expenses", value: pesoOrDash(c.household_expenses) },
    { label: "Existing debt payments", value: pesoOrDash(c.existing_debt_payments) },
    {
      label: "Proposed payment",
      value: pesoOrDash(c.proposed_payment),
      ...(c.proposed_payment_basis ? { note: c.proposed_payment_basis } : {}),
    },
    { label: "Disposable income", value: pesoOrDash(c.disposable_income) },
    { label: "Suggested maximum payment", value: pesoOrDash(c.suggested_maximum_payment) },
    { label: "Debt service ratio", value: c.debt_service_ratio === null ? "—" : `${c.debt_service_ratio}%` },
    { label: "Assessment", value: labelOf(CAPACITY_ASSESSMENT_LABELS, c.assessment) },
    { label: "Proposed payment fits", value: yesNoOrDash(c.proposed_fits) },
  ];
}

export const FINANCIALS_HIDDEN_NOTE =
  "Income and capacity figures are shown to staff who can read the member's details and loans.";

export type CapacityView =
  | { kind: "hidden"; note: string }
  | { kind: "none"; note: string }
  | { kind: "rows"; rows: CapacityRow[] };

/**
 * What the capacity section shows. With `financials_hidden` the server sent
 * no figures for this caller, which is said in words rather than as a row of
 * dashes that would read as "nothing declared".
 */
export function capacityView(capacity: CreditCapacity | null, financialsHidden: boolean): CapacityView {
  if (financialsHidden) return { kind: "hidden", note: FINANCIALS_HIDDEN_NOTE };
  if (!capacity) return { kind: "none", note: "No capacity figures yet." };
  return { kind: "rows", rows: capacityRows(capacity) };
}
