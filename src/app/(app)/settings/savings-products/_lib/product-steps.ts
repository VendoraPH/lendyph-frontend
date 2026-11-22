/**
 * The savings product dialog as steps for `FormStepper` (Arvin, 2026-11-17:
 * long forms become numbered steps). Layout only: the fields, labels, checks
 * and payload are the dialog's own (`readCreateDraft`, `readUpdateDraft`);
 * this file says which step holds each one. Dependency-free, so it runs under
 * `tsx --test`.
 *
 * Field keys are the payload's (and so a 422's) keys. The dialog gives each
 * field a `data-field` equal to its key, so an error focuses it.
 */

import type { FormStepDef } from "@/lib/form-stepper";
import type { SavingsProductKind } from "@/types";

/**
 * The steps. Titles are the form's own sections ("Limits", "Withdrawals",
 * "Allowed", "Eligibility"); the fields above them had none. A time deposit
 * product takes only eligibility from the rules, as the form showed before.
 */
export function productSteps(kind: SavingsProductKind): FormStepDef[] {
  const steps: FormStepDef[] = [
    { id: "details", title: "Details", fields: ["kind", "code", "name", "is_active"] },
    {
      id: "interest",
      title: "Interest & balances",
      fields: [
        "annual_interest_rate",
        "interest_crediting",
        "pretermination_product_id",
        "term_options_days",
        "minimum_opening_balance",
        "maintaining_balance",
        "minimum_adb_for_interest",
      ],
    },
  ];
  if (kind !== "time_deposit") {
    steps.push(
      {
        id: "limits",
        title: "Limits & withdrawals",
        fields: [
          "max_balance",
          "min_deposit",
          "max_deposit",
          "min_withdrawal",
          "max_withdrawal",
          "free_withdrawals_per_month",
          "excess_withdrawal_fee",
        ],
      },
      { id: "allowed", title: "Allowed", fields: ["allow_deposits", "allow_withdrawals", "allow_transfers"] },
    );
  }
  steps.push({ id: "eligibility", title: "Eligibility", fields: ["eligible_member_types", "eligible_branch_ids"] });
  return steps;
}

/**
 * Each problem the form names (`readCreateDraft`'s labels), and the field it
 * belongs to. A label with a note matches as "Label (…)".
 */
const PROBLEM_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["Code", "code"],
  ["Name", "name"],
  ["Interest rate", "annual_interest_rate"],
  ["Terms offered", "term_options_days"],
  ["Minimum placement", "minimum_opening_balance"],
  ["Minimum opening balance", "minimum_opening_balance"],
  ["Maintaining balance", "maintaining_balance"],
  ["Minimum average daily balance to earn interest", "minimum_adb_for_interest"],
  ["Maximum balance", "max_balance"],
  ["Minimum deposit", "min_deposit"],
  ["Maximum deposit", "max_deposit"],
  ["Minimum withdrawal", "min_withdrawal"],
  ["Maximum withdrawal", "max_withdrawal"],
  ["Free withdrawals a month", "free_withdrawals_per_month"],
  ["Excess-withdrawal fee", "excess_withdrawal_fee"],
];

function fieldOfProblem(problem: string): string | null {
  const hit = PROBLEM_FIELDS.find(([label]) => problem === label || problem.startsWith(`${label} (`));
  return hit ? hit[1] : null;
}

/**
 * The form's problems keyed by field, each keeping its own words, so Next
 * lists the open step's labels the way Save listed them all. A problem the
 * form doesn't know is left out; Save's own check still names it.
 */
export function productProblemErrors(problems: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const problem of problems) {
    const field = fieldOfProblem(problem);
    if (field && !(field in out)) out[field] = problem;
  }
  return out;
}
