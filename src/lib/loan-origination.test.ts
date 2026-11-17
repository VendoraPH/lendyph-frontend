import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APPLICATION_STATUSES,
  STAFF_TRANSITIONS,
  ageOn,
  allowedTransitions,
  borrowerFacingStatus,
  completedSteps,
  completionPercent,
  declaredMonthlyIncome,
  emptyDraft,
  fileProblem,
  formatDuration,
  maskMobile,
  mergeDraft,
  monthlyDebtPayments,
  monthlyExpenses,
  parseAmount,
  percentChange,
  ratioTone,
  toMonthly,
  validateContact,
  validateEmployment,
  validateExpenses,
  validateLoanRequest,
  validatePersonal,
} from "./loan-origination";
import type { PublicLoanProduct } from "@/types/loan-origination";

const product: PublicLoanProduct = {
  id: 1,
  name: "Salary Loan",
  description: null,
  eligible_applicants: null,
  min_amount: 5000,
  max_amount: 100000,
  min_term: 3,
  max_term: 24,
  term_unit: "months",
  payment_frequencies: ["monthly", "semi_monthly"],
  interest_method: "diminishing",
  interest_rate: 2,
  interest_rate_frequency: "monthly",
  eligibility: null,
  instructions: null,
};

test("staff can never move an application into approved, converted or a pre-submission status", () => {
  for (const from of APPLICATION_STATUSES) {
    for (const to of STAFF_TRANSITIONS[from]) {
      assert.ok(!["approved", "converted", "draft", "incomplete", "submitted"].includes(to), `${from} → ${to}`);
    }
  }
});

test("closed and unsubmitted applications offer no manual moves", () => {
  for (const s of ["draft", "incomplete", "approved", "rejected", "withdrawn", "converted", "expired"] as const) {
    assert.deepEqual(allowedTransitions(s), []);
  }
});

test("applicants see Under Review for every internal processing step", () => {
  assert.equal(borrowerFacingStatus("document_verification"), "under_review");
  assert.equal(borrowerFacingStatus("under_assessment"), "under_review");
  assert.equal(borrowerFacingStatus("pending_approval"), "under_review");
  assert.equal(borrowerFacingStatus("submitted"), "received");
  assert.equal(borrowerFacingStatus("converted"), "approved");
  assert.equal(borrowerFacingStatus("rejected"), "not_approved");
});

test("toMonthly converts each frequency the documented way", () => {
  assert.equal(toMonthly(1000, "monthly"), 1000);
  assert.equal(toMonthly(1000, "weekly"), 4333.33);
  assert.equal(toMonthly(1000, "bi_weekly"), 2166.67);
  assert.equal(toMonthly(1000, "semi_monthly"), 2000);
  assert.equal(toMonthly(500, "daily"), 13000);
  assert.equal(toMonthly(12000, "annual"), 1000);
  assert.equal(toMonthly(-5, "monthly"), 0);
  assert.equal(toMonthly(Number.NaN, "monthly"), 0);
});

test("parseAmount accepts commas and the peso sign, and refuses negatives", () => {
  assert.equal(parseAmount("25,000"), 25000);
  assert.equal(parseAmount("₱1,500.50"), 1500.5);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseAmount("abc"), null);
});

test("declared income: salaried uses net pay, else gross, plus other income", () => {
  const e = { ...emptyDraft().employment, income_source: "employed" as const, gross_monthly_income: "30000", other_regular_income: "2000" };
  assert.equal(declaredMonthlyIncome(e), 32000);
  assert.equal(declaredMonthlyIncome({ ...e, net_monthly_income: "25000" }), 27000);
});

test("declared income: a business without a net figure is revenue less expenses, never negative", () => {
  const e = { ...emptyDraft().employment, income_source: "business_owner" as const, monthly_revenue: "50000", monthly_business_expenses: "35000" };
  assert.equal(declaredMonthlyIncome(e), 15000);
  assert.equal(declaredMonthlyIncome({ ...e, monthly_business_expenses: "60000" }), 0);
  assert.equal(declaredMonthlyIncome({ ...e, monthly_net_business_income: "12000" }), 12000);
});

test("declared income: other sources convert their frequency", () => {
  const e = { ...emptyDraft().employment, income_source: "farmer" as const, other_income_amount: "60000", other_income_frequency: "quarterly" as const };
  assert.equal(declaredMonthlyIncome(e), 20000);
});

test("expenses and debts add up, and existing loans count only when declared", () => {
  const x = {
    ...emptyDraft().expenses,
    housing: "5000",
    food: "8000",
    credit_card_payments: "1500",
    has_existing_loans: true,
    existing_loans: [{ institution: "Bank", outstanding_balance: "", payment_amount: "1000", payment_frequency: "weekly" as const, remaining_term: "" }],
  };
  assert.equal(monthlyExpenses(x), 13000);
  assert.equal(monthlyDebtPayments(x), 5833.33);
  assert.equal(monthlyDebtPayments({ ...x, has_existing_loans: false }), 1500);
});

test("contact validation accepts PH mobile formats and an optional email", () => {
  assert.deepEqual(validateContact("0917 123 4567", ""), {});
  assert.deepEqual(validateContact("+639171234567", "a@b.ph"), {});
  assert.ok(validateContact("12345", "").mobile);
  assert.ok(validateContact("09171234567", "nope").email);
});

test("age is counted in whole years and an applicant must be 18", () => {
  assert.equal(ageOn("2000-11-18", "2026-11-17"), 25);
  assert.equal(ageOn("2000-11-17", "2026-11-17"), 26);
  const p = { ...emptyDraft().personal, first_name: "A", last_name: "B", province: "P", city: "C", barangay: "B", street_address: "S" };
  assert.ok(validatePersonal({ ...p, date_of_birth: "2010-01-01" }, "2026-11-17").date_of_birth);
  assert.deepEqual(validatePersonal({ ...p, date_of_birth: "1990-01-01" }, "2026-11-17"), {});
});

test("employment validation asks only for the chosen source's fields", () => {
  const base = emptyDraft().employment;
  assert.ok(validateEmployment(base).income_source);
  const employed = validateEmployment({ ...base, income_source: "employed" });
  assert.ok(employed.employer_name && employed.gross_monthly_income);
  assert.equal(employed.monthly_revenue, undefined);
});

test("expenses validation requires an answer about existing loans and checks each loan", () => {
  const x = emptyDraft().expenses;
  assert.ok(validateExpenses(x).has_existing_loans);
  assert.deepEqual(validateExpenses({ ...x, has_existing_loans: false }), {});
  const errs = validateExpenses({
    ...x,
    has_existing_loans: true,
    existing_loans: [{ institution: "", outstanding_balance: "", payment_amount: "", payment_frequency: "", remaining_term: "" }],
  });
  assert.ok(errs["existing_loans.0.institution"] && errs["existing_loans.0.payment_amount"]);
});

test("loan request must sit inside the product's amount and term range", () => {
  const l = { loan_product_id: 1, amount: "20000", purpose: "Tuition", term: "12", frequency: "monthly", release_method: "" };
  assert.deepEqual(validateLoanRequest(l, product), {});
  assert.ok(validateLoanRequest({ ...l, amount: "500" }, product).amount);
  assert.ok(validateLoanRequest({ ...l, term: "36" }, product).term);
  assert.ok(validateLoanRequest({ ...l, frequency: "" }, product).frequency);
  assert.ok(validateLoanRequest(l, undefined).loan_product_id);
});

test("completion counts the seven steps before review", () => {
  const draft = emptyDraft();
  assert.equal(completionPercent(completedSteps(draft, product, "2026-11-17", false, false)), 0);
  draft.loan.loan_product_id = 1;
  assert.equal(completionPercent(completedSteps(draft, product, "2026-11-17", true, false)), 29);
});

test("mergeDraft fills fields an older draft lacks", () => {
  const merged = mergeDraft({ personal: { first_name: "Ana" } } as never);
  assert.equal(merged.personal.first_name, "Ana");
  assert.equal(merged.personal.last_name, "");
  assert.deepEqual(merged.expenses.existing_loans, []);
});

test("ratioTone compares against the configured limit only", () => {
  assert.equal(ratioTone(35, 40, "max"), "success");
  assert.equal(ratioTone(45, 40, "max"), "danger");
  assert.equal(ratioTone(1.1, 1.25, "min"), "danger");
  assert.equal(ratioTone(null, 40, "max"), "neutral");
});

test("small helpers", () => {
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(5, 0), null);
  assert.equal(formatDuration(36), "36 hours");
  assert.equal(formatDuration(72), "3 days");
  assert.equal(formatDuration(null), "—");
  assert.equal(maskMobile("09171234567"), "0917•••4567");
  assert.equal(fileProblem({ name: "id.PDF", size: 1000, type: "" }, ["pdf", "jpg"], 5), null);
  assert.ok(fileProblem({ name: "id.exe", size: 1000, type: "" }, ["pdf"], 5));
  assert.ok(fileProblem({ name: "id.pdf", size: 6 * 1024 * 1024, type: "" }, ["pdf"], 5));
});
