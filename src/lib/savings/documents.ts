/**
 * The savings documents the screens print straight from a record (gap round
 * F4b), through the printables catalog's own entries, so a document reads
 * the same from the catalog and from the record. Ids are the catalog's.
 */
export interface SavingsDocument {
  id: string;
  label: string;
}

/** From the account page. */
export const ACCOUNT_DOCUMENTS: readonly SavingsDocument[] = [
  { id: "savings_opening_form", label: "Opening form" },
  { id: "savings_agreement", label: "Account agreement" },
  { id: "savings_closure_form", label: "Closure form" },
  { id: "savings_dormancy_notice", label: "Dormancy notice" },
];

/** From a posted withdrawal line. */
export const WITHDRAWAL_SLIP: SavingsDocument = { id: "savings_withdrawal_slip", label: "Withdrawal slip" };

/** From a time deposit: the maturity notice always; the early termination form while it runs. */
export function timeDepositDocuments(status: string): SavingsDocument[] {
  const notice = { id: "time_deposit_maturity_notice", label: "Maturity notice" };
  return status === "active" ? [notice, { id: "time_deposit_early_termination", label: "Early termination form" }] : [notice];
}
