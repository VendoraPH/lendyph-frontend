/**
 * The Open Account dialog as steps for `FormStepper` (Arvin, 2026-11-17: long
 * forms become numbered steps). Layout only: the fields, labels, checks and
 * payload are the dialog's own; this file says which step holds each one.
 * Dependency-free, so it runs under `tsx --test`.
 *
 * Field keys are the payload's (and so a 422's) keys. The dialog gives each
 * field a `data-field` equal to its key, so an error focuses it.
 */

import type { FormStepDef } from "@/lib/form-stepper";
import type { OpenSavingsAccountInput } from "@/types";
import { presentErrors } from "./step-errors";

/**
 * Every key the dialog sends on `POST /savings/accounts`. Typed by hand: keep
 * it in step with the dialog's body and `readOpeningDetails`.
 */
export const OPEN_ACCOUNT_SENT_FIELDS = [
  "borrower_id",
  "product_id",
  "opened_at",
  "initial_deposit",
  "payment_method",
  "reference",
  "account_officer_id",
  "source_of_funds",
  "source_of_funds_other",
  "beneficiary",
] as const satisfies ReadonlyArray<keyof OpenSavingsAccountInput>;

export const OPEN_ACCOUNT_STEPS: readonly FormStepDef[] = [
  { id: "member", title: "Member & product", fields: ["borrower_id", "product_id"] },
  {
    id: "deposit",
    title: "Opening deposit",
    fields: ["opened_at", "initial_deposit", "payment_method", "reference"],
  },
  {
    id: "details",
    title: "Opening details",
    fields: ["account_officer_id", "source_of_funds", "source_of_funds_other", "beneficiary"],
  },
];

/** The dialog's own checks, already worked out (null is no error). */
export interface OpenAccountCheck {
  memberError: string | null;
  productError: string | null;
  dateError: string | null;
  amountError: string | null;
  /** The first opening-details problem: "Other" chosen with nothing typed. */
  sourceError: string | null;
}

/** The dialog's checks, keyed by the field each one belongs to. */
export function openAccountErrors(c: OpenAccountCheck): Record<string, string> {
  return presentErrors({
    borrower_id: c.memberError,
    product_id: c.productError,
    opened_at: c.dateError,
    initial_deposit: c.amountError,
    source_of_funds_other: c.sourceError,
  });
}
