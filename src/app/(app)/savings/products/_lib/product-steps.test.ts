import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError, stepErrorsOf } from "@/lib/form-stepper";
import { readCreateDraft, readUpdateDraft, toDraft, type ProductDraft } from "./product-draft";
import { productProblemErrors, productSteps } from "./product-steps";

/** A regular draft where every field the form checks is wrong. */
const ALL_WRONG_REGULAR: ProductDraft = {
  ...toDraft(null, "regular"),
  code: " ",
  name: "",
  rate: "lots",
  minOpening: "1.234",
  maintaining: "x",
  minAdb: "-",
  maxBalance: "a",
  minDeposit: "b",
  maxDeposit: "c",
  minWithdrawal: "d",
  maxWithdrawal: "e",
  freeWithdrawals: "many",
  excessMode: "fee",
  excessFee: "f",
};

const ALL_WRONG_TD: ProductDraft = { ...toDraft(null, "time_deposit"), code: "", name: "", rate: "", terms: "", minOpening: "z" };

function owners(field: string, steps = productSteps("regular")): number {
  return steps.filter((s) => (s.fields ?? []).some((f) => f === field || field.startsWith(`${f}.`))).length;
}

test("a regular product's steps follow the form's sections", () => {
  assert.deepEqual(
    productSteps("regular").map((s) => s.title),
    ["Details", "Interest & balances", "Limits & withdrawals", "Allowed", "Eligibility"],
  );
});

test("a time deposit product shows eligibility only from the rules, as before", () => {
  assert.deepEqual(
    productSteps("time_deposit").map((s) => s.title),
    ["Details", "Interest & balances", "Eligibility"],
  );
});

test("every field either kind sends belongs to exactly one step", () => {
  const regular = readCreateDraft({ ...toDraft(null, "regular"), freeWithdrawals: "2", excessFee: "5" }).input;
  for (const field of Object.keys(regular)) assert.equal(owners(field), 1, field);
  const td = readCreateDraft({ ...toDraft(null, "time_deposit"), terms: "90", preProductId: "4" }).input;
  for (const field of Object.keys(td)) assert.equal(owners(field, productSteps("time_deposit")), 1, field);
});

test("no field is listed on two steps", () => {
  const listed = productSteps("regular").flatMap((s) => s.fields ?? []);
  assert.equal(new Set(listed).size, listed.length);
});

test("every problem the form names maps to one field on one step, keeping its words", () => {
  for (const [draft, kind] of [
    [ALL_WRONG_REGULAR, "regular"],
    [ALL_WRONG_TD, "time_deposit"],
  ] as const) {
    const { problems } = readCreateDraft(draft);
    const errors = productProblemErrors(problems);
    assert.deepEqual(Object.values(errors).sort(), [...problems].sort(), kind);
    for (const key of Object.keys(errors)) assert.equal(owners(key, productSteps(kind)), 1, `${kind} ${key}`);
  }
});

test("each step checks only its own fields", () => {
  const errors = productProblemErrors(readCreateDraft(ALL_WRONG_REGULAR).problems);
  const [details, interest, limits, allowed, eligibility] = productSteps("regular");
  assert.deepEqual(stepErrorsOf(errors, details), { code: "Code", name: "Name" });
  assert.deepEqual(Object.keys(stepErrorsOf(errors, interest)).sort(), [
    "annual_interest_rate",
    "maintaining_balance",
    "minimum_adb_for_interest",
    "minimum_opening_balance",
  ]);
  assert.deepEqual(Object.keys(stepErrorsOf(errors, limits)).sort(), [
    "excess_withdrawal_fee",
    "free_withdrawals_per_month",
    "max_balance",
    "max_deposit",
    "max_withdrawal",
    "min_deposit",
    "min_withdrawal",
  ]);
  assert.deepEqual(stepErrorsOf(errors, allowed), {});
  assert.deepEqual(stepErrorsOf(errors, eligibility), {});
});

test("an edit checks the same fields, without the first rate", () => {
  const errors = productProblemErrors(readUpdateDraft(ALL_WRONG_REGULAR).problems);
  assert.equal("annual_interest_rate" in errors, false);
  assert.equal(errors.code, "Code");
});

test("a 422 opens the step that holds its field, dotted keys included", () => {
  const steps = productSteps("regular");
  assert.equal(firstStepWithError({ max_deposit: ["Below the minimum deposit."] }, steps), 2);
  assert.equal(firstStepWithError({ "eligible_branch_ids.0": ["Unknown branch."] }, steps), 4);
  assert.equal(firstStepWithError({ is_active: ["Set up the books first."] }, steps), 0);
  assert.equal(firstStepWithError({ "term_options_days.1": ["Not a term."] }, productSteps("time_deposit")), 1);
});

test("a problem the form doesn't know stays off every step", () => {
  assert.deepEqual(productProblemErrors(["Something new"]), {});
});
