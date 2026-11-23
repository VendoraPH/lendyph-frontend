import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyDraft } from "@/lib/loan-origination";
import type { PublicDocument, PublicProduct } from "@/types/public-application";
import {
  draftAfterVerify,
  errorsAfterSave,
  estimateRequest,
  missingDocumentsMessage,
  problemsByStep,
  resumeStepIndex,
  stepErrors,
  typedAmount,
} from "./wizard-state";

// The wizard reads what blocks a step from the server (LO-B2's
// `missing_fields`, keyed `draft.<section>.<field>`, and a submit's 422 keyed
// the same way) instead of checking the draft itself.

const MISSING = {
  "draft.personal.gender": "Choose your gender.",
  "draft.personal.civil_status": "Choose your civil status.",
  "draft.employment.income_source": "Choose where most of your income comes from.",
  "draft.expenses.existing_loans.0.institution": "Enter the lender's name.",
  "draft.loan.loan_product_id": "Choose a loan product.",
  "draft.loan.amount": "Enter an amount from ₱5,000.00 to ₱50,000.00.",
};

test("a step's errors are its own section's, keyed by field", () => {
  assert.deepEqual(stepErrors("personal", MISSING), {
    gender: "Choose your gender.",
    civil_status: "Choose your civil status.",
  });
  assert.deepEqual(stepErrors("expenses", MISSING), { "existing_loans.0.institution": "Enter the lender's name." });
  assert.deepEqual(stepErrors("product", MISSING), { loan_product_id: "Choose a loan product." });
});

test("the loan step also holds the product refusal, so it never passes without one", () => {
  assert.deepEqual(stepErrors("loan", MISSING), {
    loan_product_id: "Choose a loan product.",
    amount: "Enter an amount from ₱5,000.00 to ₱50,000.00.",
  });
});

test("a step with nothing missing passes", () => {
  assert.deepEqual(stepErrors("employment", { "draft.personal.gender": "Choose your gender." }), {});
  assert.deepEqual(stepErrors("documents", MISSING), {});
});

test("what blocks a submit is listed by step, in the wizard's order, in the server's words", () => {
  const groups = problemsByStep({
    terms_version: "Read and accept the current terms and conditions to continue.",
    documents: "Upload your valid government id.",
    ...MISSING,
  });
  assert.deepEqual(
    groups.map((g) => [g.step, g.title, g.messages]),
    [
      ["product", "Loan product", ["Choose a loan product."]],
      ["personal", "Personal details", ["Choose your gender.", "Choose your civil status."]],
      ["employment", "Income", ["Choose where most of your income comes from."]],
      ["expenses", "Expenses and debts", ["Enter the lender's name."]],
      ["loan", "Loan details", ["Enter an amount from ₱5,000.00 to ₱50,000.00."]],
      ["documents", "Documents", ["Upload your valid government id."]],
      ["review", "Review and submit", ["Read and accept the current terms and conditions to continue."]],
    ],
  );
});

test("a refusal on no known step is still listed, under Review", () => {
  assert.deepEqual(problemsByStep({ draft: "The application could not be read. Refresh and try again." }), [
    { step: "review", title: "Review and submit", messages: ["The application could not be read. Refresh and try again."] },
  ]);
  assert.deepEqual(problemsByStep({}), []);
});

const DOC = (over: Partial<PublicDocument>): PublicDocument => ({
  id: null,
  type: "government_id",
  label: "Valid government ID",
  required: true,
  status: "not_submitted",
  file_name: null,
  mime_type: null,
  size_bytes: null,
  uploaded_at: null,
  ...over,
});

test("missing required documents read as the server's submit refusal", () => {
  const documents = [
    DOC({}),
    DOC({ type: "proof_of_income", label: "Proof of income" }),
    DOC({ type: "proof_of_address", label: "Proof of address", required: false }),
  ];
  assert.equal(missingDocumentsMessage(documents), "Upload your valid government id and proof of income.");
  assert.equal(
    missingDocumentsMessage([DOC({ id: "01jz0000000000000000000000", status: "uploaded", file_name: "id.png" })]),
    null,
  );
});

test("a resumed application opens after the server's last completed step", () => {
  assert.equal(resumeStepIndex(null), 2);
  assert.equal(resumeStepIndex("contact"), 2);
  assert.equal(resumeStepIndex("employment"), 4);
  assert.equal(resumeStepIndex("documents"), 7);
  assert.equal(resumeStepIndex("review"), 7);
  assert.equal(resumeStepIndex("something_else"), 2);
});

test("after the code, the saved draft is kept, with the product just chosen", () => {
  const local = emptyDraft();
  local.loan = { ...local.loan, loan_product_id: 9, frequency: "monthly" };
  const saved = emptyDraft();
  saved.personal.first_name = "Juana";
  saved.loan = { ...saved.loan, loan_product_id: 4, amount: "20000", frequency: "weekly" };

  const merged = draftAfterVerify(local, saved, []);
  assert.equal(merged.personal.first_name, "Juana");
  assert.equal(merged.loan.loan_product_id, 9);
  assert.equal(merged.loan.frequency, "monthly");
  assert.equal(merged.loan.amount, "20000");
});

test("after the code, a saved product stays when none was chosen", () => {
  const saved = emptyDraft();
  saved.loan = { ...saved.loan, loan_product_id: 4, frequency: "weekly" };
  assert.deepEqual(draftAfterVerify(emptyDraft(), saved, []).loan, saved.loan);
});

test("a link with one branch fills it in, so the application always has one", () => {
  assert.equal(draftAfterVerify(emptyDraft(), emptyDraft(), [{ id: 3 }]).personal.branch_id, 3);
  assert.equal(draftAfterVerify(emptyDraft(), emptyDraft(), [{ id: 3 }, { id: 4 }]).personal.branch_id, null);
  const saved = emptyDraft();
  saved.personal.branch_id = 4;
  assert.equal(draftAfterVerify(emptyDraft(), saved, [{ id: 3 }]).personal.branch_id, 4);
});

test("a typed amount is read as the server reads it: commas, spaces and ₱ ignored, two decimals at most", () => {
  assert.equal(typedAmount("25,000"), "25000");
  assert.equal(typedAmount(" ₱ 25,000.50 "), "25000.50");
  assert.equal(typedAmount("25000.505"), null);
  assert.equal(typedAmount("-500"), null);
  assert.equal(typedAmount("abc"), null);
  assert.equal(typedAmount(""), null);
});

const PRODUCT: PublicProduct = {
  id: 7,
  name: "Salary Loan",
  description: null,
  min_amount: 5000,
  max_amount: 50000,
  min_term: 3,
  max_term: 12,
  term_unit: "months",
  payment_frequencies: ["monthly", "semi_monthly"],
  interest_method: "diminishing",
  interest_rate: 2.5,
  interest_rate_frequency: "monthly",
  eligibility: null,
  instructions: null,
};

test("an estimate is asked for once the product, amount, term and schedule are given", () => {
  const loan = { loan_product_id: 7, amount: "20,000", purpose: "", term: "6", frequency: "monthly", release_method: "" };
  assert.deepEqual(estimateRequest(loan, PRODUCT), { loan_product_id: 7, amount: "20000", term: 6, frequency: "monthly" });
  assert.equal(estimateRequest({ ...loan, frequency: "" }, PRODUCT), null);
  assert.equal(estimateRequest({ ...loan, amount: "20,000.123" }, PRODUCT), null);
  assert.equal(estimateRequest({ ...loan, term: "" }, PRODUCT), null);
  assert.equal(estimateRequest({ ...loan, term: "6.5" }, PRODUCT), null);
  assert.equal(estimateRequest({ ...loan, term: "0" }, PRODUCT), null);
  assert.equal(estimateRequest(loan, undefined), null);
});

test("a product with one schedule lets the server choose it", () => {
  const single = { ...PRODUCT, payment_frequencies: ["monthly"] };
  const loan = { loan_product_id: 7, amount: "20000", purpose: "", term: "6", frequency: "", release_method: "" };
  assert.deepEqual(estimateRequest(loan, single), { loan_product_id: 7, amount: "20000", term: 6, frequency: null });
});

test("the range is the server's to check: an amount outside it is still sent", () => {
  const loan = { loan_product_id: 7, amount: "900000", purpose: "", term: "60", frequency: "monthly", release_method: "" };
  assert.deepEqual(estimateRequest(loan, PRODUCT), { loan_product_id: 7, amount: "900000", term: 60, frequency: "monthly" });
});

// A step's errors follow the server once it answers again (an autosave, or a
// file changed): one it no longer names is fixed and goes at once, one it
// still names keeps the server's current words, and nothing new appears
// before Next (browser check of #657: "Enter your employer name." stayed
// after "Saved").

const SAVED = (missing_fields: Record<string, string>, documents: PublicDocument[] = []) => ({ missing_fields, documents });

test("a field's error goes once the server no longer names it after the autosave", () => {
  assert.deepEqual(errorsAfterSave("employment", { employer_name: "Enter your employer name." }, SAVED({})), {});
});

test("a field still missing keeps its error, in the server's current words", () => {
  const errors = { gross_monthly_income: "Enter your gross monthly income." };
  const state = SAVED({ "draft.employment.gross_monthly_income": "Enter an amount in pesos, like 5000." });
  assert.deepEqual(errorsAfterSave("employment", errors, state), { gross_monthly_income: "Enter an amount in pesos, like 5000." });
});

test("nothing new is shown before Next", () => {
  assert.deepEqual(errorsAfterSave("employment", {}, SAVED({ "draft.employment.job_title": "Enter your job title." })), {});
});

test("one existing loan fixed drops only its own error", () => {
  const errors = { "existing_loans.0.institution": "Enter the lender's name.", "existing_loans.1.payment_amount": "Enter the regular payment amount." };
  const state = SAVED({ "draft.expenses.existing_loans.1.payment_amount": "Enter the regular payment amount." });
  assert.deepEqual(errorsAfterSave("expenses", errors, state), { "existing_loans.1.payment_amount": "Enter the regular payment amount." });
});

test("the documents error stays while a required file is missing and goes once it's uploaded", () => {
  const errors = { documents: "Upload your valid government id." };
  assert.deepEqual(errorsAfterSave("documents", errors, SAVED({}, [DOC({})])), errors);
  assert.deepEqual(errorsAfterSave("documents", errors, SAVED({}, [DOC({ id: "01jz0000000000000000000000", status: "uploaded", file_name: "id.png" })])), {});
});
