/**
 * The Place Time Deposit dialog as steps for `FormStepper` (Arvin, 2026-11-17:
 * long forms become numbered steps). Layout only: the fields, labels, checks
 * and payload are the dialog's own (`checkPlacement`); this file says which
 * step holds each one. Dependency-free, so it runs under `tsx --test`.
 *
 * Field keys are the payload's (and so a 422's) keys. The dialog gives each
 * field a `data-field` equal to its key, so an error focuses it.
 */

import type { FormStepDef } from "@/lib/form-stepper";
import type { PlaceTimeDepositInput } from "@/types";
import { presentErrors } from "../../_lib/step-errors";
import type { PlacementCheck } from "./placement-form";

/** Every key the dialog can send on `POST /savings/time-deposits`. */
export const PLACEMENT_SENT_FIELDS = [
  "borrower_id",
  "product_id",
  "term_days",
  "principal",
  "placement_date",
  "maturity_instruction",
  "payment_method",
  "reference",
  "funding_account_id",
  "payout_account_id",
] as const satisfies ReadonlyArray<keyof PlaceTimeDepositInput>;

/** The last step shows the server's figures for the placement, as the dialog did under its fields. */
export const PLACEMENT_STEPS: readonly FormStepDef[] = [
  { id: "member", title: "Member & product", fields: ["borrower_id", "product_id", "term_days"] },
  {
    id: "payment",
    title: "Amount & payment",
    fields: [
      "principal",
      "placement_date",
      "maturity_instruction",
      "payment_method",
      "reference",
      "funding_account_id",
      "payout_account_id",
    ],
  },
  { id: "review", title: "Review", fields: [] },
];

/** `checkPlacement`'s errors, keyed by the field each one belongs to. */
export function placementErrors(errors: PlacementCheck["errors"]): Record<string, string> {
  return presentErrors({
    borrower_id: errors.member,
    product_id: errors.product,
    term_days: errors.term,
    principal: errors.amount,
    placement_date: errors.date,
    funding_account_id: errors.funding,
  });
}
