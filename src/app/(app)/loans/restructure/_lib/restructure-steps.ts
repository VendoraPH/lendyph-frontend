/**
 * The Restructure Loan form as steps for `FormStepper` (Arvin, 2026-11-17:
 * long forms become numbered steps). Layout only: the fields, labels, checks
 * and payload are the form's own; this file says which step holds each one.
 * Dependency-free, so it runs under `tsx --test`.
 *
 * Field keys are the payload's (and so a 422's) keys; `source_loan_id` is the
 * loan in the URL, and `status` is the API's own gate on that loan.
 */

import type { FormStepDef } from "@/lib/form-stepper";

/**
 * Every key the form sends on `POST /loans/{loan}/restructure`. Typed by hand:
 * keep it in step with the page's payload.
 */
export const RESTRUCTURE_SENT_FIELDS = [
  "borrower_id",
  "co_maker_ids",
  "account_officer_id",
  "purpose",
  "loan_product_id",
  "principal_amount",
  "term",
  "frequency",
  "interest_rate",
  "scb_amount",
  "start_date",
  "deductions",
  "remarks",
  "policy_exception",
  "policy_exception_details",
] as const;

export const RESTRUCTURE_STEPS: readonly FormStepDef[] = [
  {
    id: "source",
    title: "Source Loan",
    fields: ["borrower_id", "source_loan_id", "status", "co_maker_ids", "account_officer_id", "purpose"],
  },
  {
    id: "terms",
    title: "Loan Product & Terms",
    fields: ["loan_product_id", "principal_amount", "term", "frequency", "interest_rate", "scb_amount", "start_date"],
  },
  { id: "collaterals", title: "Collaterals", fields: ["collaterals"] },
  { id: "deductions", title: "Deductions", fields: ["deductions"] },
  {
    id: "remarks",
    title: "Remarks & Policy Exception",
    fields: ["remarks", "policy_exception", "policy_exception_details"],
  },
];

/** What the form's submit check reads, already worked out by the page. */
export interface RestructureCheck {
  hasMember: boolean;
  /** A source loan is picked and its details have loaded (the form shows). */
  hasSourceLoan: boolean;
  hasProduct: boolean;
  principalOk: boolean;
  termOk: boolean;
  hasFrequency: boolean;
  rateOk: boolean;
  hasRestructureDate: boolean;
  /** The server's shortfall rule asks for remarks and they are blank. */
  remarksMissing: boolean;
}

/**
 * The form's submit check, keyed by field: Next lists the open step's labels,
 * and Submit lists them all, in this order, in one "Please complete" message.
 */
export function restructureMissing(c: RestructureCheck): Record<string, string> {
  const missing: Record<string, string> = {};
  if (!c.hasMember) missing.borrower_id = "Member";
  if (!c.hasSourceLoan) missing.source_loan_id = "Source loan";
  if (!c.hasProduct) missing.loan_product_id = "Loan product";
  if (!c.principalOk) missing.principal_amount = "Principal amount";
  if (!c.termOk) missing.term = "Term";
  if (!c.hasFrequency) missing.frequency = "Payment frequency";
  if (!c.rateOk) missing.interest_rate = "Interest rate";
  if (!c.hasRestructureDate) missing.start_date = "Restructure date";
  if (c.remarksMissing) missing.remarks = "Remarks";
  return missing;
}
