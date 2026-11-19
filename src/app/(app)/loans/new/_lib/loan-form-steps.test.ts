import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError, stepErrorsOf, stepIndexForField } from "@/lib/form-stepper";
import {
  LOAN_FORM_SENT_FIELDS,
  invalidStepMessages,
  loanFormMissing,
  loanFormSteps,
  serverFieldErrors,
  type LoanFormCheck,
} from "./loan-form-steps";

const ALL_OK: LoanFormCheck = {
  hasMember: true,
  hasProduct: true,
  principalOk: true,
  termOk: true,
  hasFrequency: true,
  rateOk: true,
  hasReleaseDate: true,
  scbInvalid: false,
  processingFeeInvalid: false,
  serviceFeeInvalid: false,
  remarksMissing: false,
};

const NOTHING_OK: LoanFormCheck = {
  hasMember: false,
  hasProduct: false,
  principalOk: false,
  termOk: false,
  hasFrequency: false,
  rateOk: false,
  hasReleaseDate: false,
  scbInvalid: true,
  processingFeeInvalid: true,
  serviceFeeInvalid: true,
  remarksMissing: true,
};

const FULL = loanFormSteps({ showCollaterals: true, isRestructureEdit: false });

function ownerCount(field: string, steps = FULL): number {
  return steps.filter((s) => (s.fields ?? []).some((f) => f === field || field.startsWith(`${f}.`))).length;
}

test("the steps follow the form's cards, in order", () => {
  assert.deepEqual(
    FULL.map((s) => s.title),
    [
      "Member & Co-Maker",
      "Loan Product & Terms",
      "Collaterals",
      "Deductions & Net Proceeds",
      "Amortization Schedule Preview",
    ],
  );
});

test("every field the form sends belongs to exactly one step", () => {
  for (const field of LOAN_FORM_SENT_FIELDS) {
    assert.equal(ownerCount(field), 1, field);
  }
});

test("every check the form makes belongs to exactly one step", () => {
  for (const key of Object.keys(loanFormMissing(NOTHING_OK))) {
    assert.equal(ownerCount(key), 1, key);
  }
});

test("no field is listed on two steps", () => {
  const listed = FULL.flatMap((s) => s.fields ?? []);
  assert.equal(new Set(listed).size, listed.length);
});

test("the checks keep the form's labels and their order", () => {
  assert.deepEqual(Object.values(loanFormMissing(NOTHING_OK)), [
    "Member",
    "Loan product",
    "Loan amount",
    "Term",
    "Payment frequency",
    "Interest rate",
    "Release date",
    "Share Capital Build-Up",
    "Processing fee",
    "Service fee",
    "Remarks",
  ]);
  assert.deepEqual(loanFormMissing(ALL_OK), {});
});

test("each step validates only its own checks", () => {
  const missing = loanFormMissing(NOTHING_OK);
  const byStep = Object.fromEntries(FULL.map((s) => [s.id, Object.values(stepErrorsOf(missing, s))]));
  assert.deepEqual(byStep.member, ["Member"]);
  assert.deepEqual(byStep.terms, [
    "Loan product",
    "Loan amount",
    "Term",
    "Payment frequency",
    "Interest rate",
    "Share Capital Build-Up",
    "Remarks",
  ]);
  assert.deepEqual(byStep.collaterals, []);
  assert.deepEqual(byStep.deductions, ["Release date", "Processing fee", "Service fee"]);
  assert.deepEqual(byStep.review, []);
});

test("server 422 keys open the step that holds the field", () => {
  const index = (key: string) => stepIndexForField(key, FULL);
  assert.equal(FULL[index("borrower_id")].id, "member");
  assert.equal(FULL[index("co_maker_ids.1")].id, "member");
  assert.equal(FULL[index("policy_exception_details")].id, "member");
  assert.equal(FULL[index("principal_amount")].id, "terms");
  assert.equal(FULL[index("remarks")].id, "terms");
  assert.equal(FULL[index("collaterals.0.collateral_id")].id, "collaterals");
  assert.equal(FULL[index("deductions.2.amount")].id, "deductions");
  assert.equal(FULL[index("start_date")].id, "deductions");
  assert.equal(index("message"), -1);
});

test("the first step holding a server error opens", () => {
  const errors = { "deductions.0.amount": ["Too much."], interest_rate: ["Out of range."] };
  assert.equal(FULL[firstStepWithError(errors, FULL)].id, "terms");
});

test("the collaterals step shows only for a role that can view collaterals", () => {
  const without = loanFormSteps({ showCollaterals: false, isRestructureEdit: false });
  assert.deepEqual(
    without.map((s) => s.id),
    ["member", "terms", "deductions", "review"],
  );
  // Without the step the form never states collaterals, and nothing else moves.
  for (const field of LOAN_FORM_SENT_FIELDS.filter((f) => f !== "collaterals")) {
    assert.equal(ownerCount(field, without), 1, field);
  }
  assert.equal(stepIndexForField("collaterals.0", without), -1);
});

test("a restructure edit's deductions step keeps the card's own title", () => {
  const steps = loanFormSteps({ showCollaterals: true, isRestructureEdit: true });
  assert.equal(steps.find((s) => s.id === "deductions")?.title, "Deductions");
});

test("serverFieldErrors reads a 422's field errors only", () => {
  const err = { response: { status: 422, data: { errors: { term: ["Too long."], bad: "x" } } } };
  assert.deepEqual(serverFieldErrors(err), { term: ["Too long."] });
  assert.deepEqual(serverFieldErrors({ response: { status: 500, data: { errors: { term: ["x"] } } } }), {});
  assert.deepEqual(serverFieldErrors(new Error("boom")), {});
  assert.deepEqual(serverFieldErrors(null), {});
});

test("a failed Save lists every missing field at once; Next lists only the open step's", () => {
  const missing = loanFormMissing({ ...ALL_OK, hasMember: false, termOk: false, hasReleaseDate: false });
  const termsStepErrors = { term: "Term" };
  assert.deepEqual(invalidStepMessages("save", termsStepErrors, missing), ["Member", "Term", "Release date"]);
  assert.deepEqual(invalidStepMessages("next", termsStepErrors, missing), ["Term"]);
});
