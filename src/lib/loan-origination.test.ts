import { test } from "node:test";
import assert from "node:assert/strict";
import * as lib from "./loan-origination";
import {
  APPLICATION_STATUSES,
  EMPLOYMENT_TYPES,
  MEMBER_DOCUMENT_MAX_MB,
  RELEASE_METHODS,
  STAFF_TRANSITIONS,
  ageOn,
  allowedTransitions,
  borrowerFacingStatus,
  completedSteps,
  completionPercent,
  consentIsDraft,
  declaredExpenseRows,
  declaredIncomeRows,
  emptyDraft,
  fileProblem,
  formatDuration,
  inWords,
  maskMobile,
  mergeDraft,
  otpSentMessage,
  parseAmount,
  percentChange,
  ratioTone,
  reminderNotice,
  settingsSaveBlocker,
  allStatusCount,
  uploadRules,
  uploadSettingsProblems,
  validateContact,
  validateEmployment,
  validateExpenses,
  validateLoanRequest,
  validatePersonal,
} from "./loan-origination";
import type { PublicApplicationPortal, PublicLoanProduct } from "@/types/loan-origination";

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

test("parseAmount accepts commas and the peso sign, and refuses negatives", () => {
  assert.equal(parseAmount("25,000"), 25000);
  assert.equal(parseAmount("₱1,500.50"), 1500.5);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseAmount("abc"), null);
});

test("the browser never adds up income, expenses or debts: the server's assessment does", () => {
  for (const name of ["toMonthly", "PERIODS_PER_YEAR", "declaredMonthlyIncome", "monthlyExpenses", "monthlyDebtPayments"]) {
    assert.equal((lib as Record<string, unknown>)[name], undefined, `${name} is still exported`);
  }
});

test("declared income rows show each entered amount as typed, with no total", () => {
  const e = { ...emptyDraft().employment, income_source: "employed" as const, gross_monthly_income: "30000", net_monthly_income: "", other_regular_income: "2,000", salary_frequency: "semi_monthly" as const };
  assert.deepEqual(declaredIncomeRows(e), [
    ["Gross monthly pay", "₱30,000.00"],
    ["Paid", "Twice a month"],
    ["Other regular income a month", "₱2,000.00"],
  ]);
  const farm = { ...emptyDraft().employment, income_source: "farmer" as const, other_income_amount: "60000", other_income_frequency: "quarterly" as const };
  assert.deepEqual(declaredIncomeRows(farm), [["Amount received", "₱60,000.00 every three months"]]);
  assert.deepEqual(declaredIncomeRows(emptyDraft().employment), []);
});

test("declared expense rows list each entered line and each existing loan, with no total", () => {
  const x = {
    ...emptyDraft().expenses,
    housing: "5000",
    food: "8000",
    credit_card_payments: "1500",
    has_existing_loans: true,
    existing_loans: [{ institution: "Bank", outstanding_balance: "", payment_amount: "1000", payment_frequency: "weekly" as const, remaining_term: "" }],
  };
  assert.deepEqual(declaredExpenseRows(x), [
    ["Rent or housing", "₱5,000.00"],
    ["Food", "₱8,000.00"],
    ["Credit card payments", "₱1,500.00"],
    ["Bank", "₱1,000.00 weekly"],
  ]);
  assert.deepEqual(declaredExpenseRows({ ...x, has_existing_loans: false }).length, 3);
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

test("uploads follow the member document rules, whatever the link allows", () => {
  assert.equal(MEMBER_DOCUMENT_MAX_MB, 10);
  assert.deepEqual(uploadRules(["pdf", "JPG", "exe"], 25), { extensions: ["pdf", "jpg"], maxMb: 10 });
  assert.deepEqual(uploadRules([], 0).maxMb, 10);
  assert.ok(uploadRules([], 0).extensions.includes("jfif"));
  assert.deepEqual(uploadRules([".png"], 5), { extensions: ["png"], maxMb: 5 });
  assert.ok(fileProblem({ name: "run.exe", size: 1000, type: "" }, ["exe", "pdf"], 25));
  assert.ok(fileProblem({ name: "scan.pdf", size: 12 * 1024 * 1024, type: "" }, ["pdf"], 25));
  assert.equal(fileProblem({ name: "scan.jfif", size: 1000, type: "" }, [], 0), null);
});

test("upload settings outside the member document rules are refused before saving", () => {
  assert.deepEqual(uploadSettingsProblems({ accepted_file_types: ["pdf", "jpg"], max_upload_mb: 10 }), []);
  assert.equal(uploadSettingsProblems({ accepted_file_types: ["pdf", "exe", "heic"], max_upload_mb: 10 }).length, 1);
  assert.match(uploadSettingsProblems({ accepted_file_types: ["pdf", "exe"], max_upload_mb: 10 })[0], /EXE/);
  assert.equal(uploadSettingsProblems({ accepted_file_types: ["pdf"], max_upload_mb: 20 }).length, 1);
});

test("an OTP screen says a code was sent only when the server says it went out", () => {
  const base = { resend_after: 60, expires_in: 300, channel: "sms" as const, destination: "0917•••4567" };
  assert.match(otpSentMessage({ ...base, delivered: true }), /^We sent a code to 0917•••4567\. It expires in 5 minutes\.$/);
  for (const r of [{ ...base, delivered: false }, base]) {
    const text = otpSentMessage(r);
    assert.doesNotMatch(text, /We sent/);
    assert.match(text, /no message went out/);
  }
});

test("a reminder reads sent only when the server sent it", () => {
  assert.equal(reminderNotice({ channel: "sms", sent_at: "2026-11-19T01:00:00Z", delivered: true }), "Reminder sent to the applicant");
  assert.match(reminderNotice({ channel: "sms", sent_at: null, delivered: false }), /^Reminder logged/);
  assert.match(reminderNotice({ channel: "sms", sent_at: null }), /^Reminder logged/);
});

test("consent texts read as a draft until the server marks every one final", () => {
  const text = (final?: boolean) => ({ version: "v1", text: "…", ...(final === undefined ? {} : { final }) });
  const portal = (f?: boolean, credit: boolean | null = null) =>
    ({ privacy_notice: text(f), terms: text(f), declaration: text(f), credit_authorization: credit === null ? null : text(credit) }) as unknown as PublicApplicationPortal;
  assert.equal(consentIsDraft(portal()), true);
  assert.equal(consentIsDraft(portal(false)), true);
  assert.equal(consentIsDraft(portal(true)), false);
  assert.equal(consentIsDraft(portal(true, false)), true);
  assert.equal(consentIsDraft(portal(true, true)), false);
});

test("the All tab shows the server's total, never a sum of the status counts", () => {
  assert.equal(allStatusCount({ submitted: 3, approved: 2 }), undefined);
  assert.equal(allStatusCount({ submitted: 3, approved: 2, total: 9 }), 9);
  assert.equal(allStatusCount(undefined), undefined);
});

test("company-wide settings save only with all-branch access", () => {
  assert.equal(settingsSaveBlocker(true), null);
  assert.match(settingsSaveBlocker(false) ?? "", /all branches/i);
});

test("stored keys read in words on the staff screens", () => {
  assert.equal(inWords("bank_transfer", RELEASE_METHODS), "Bank transfer");
  assert.equal(inWords("cash", RELEASE_METHODS), "Cash at the office");
  assert.equal(inWords("ofw", EMPLOYMENT_TYPES), "Overseas worker");
  assert.equal(inWords("semi_monthly"), "Twice a month");
  assert.equal(inWords("single"), "Single");
  assert.equal(inWords(""), null);
  assert.equal(inWords(null), null);
});
