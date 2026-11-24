import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ASSESSABLE_STATUSES,
  WITHHELD_SENTENCE,
  canRunAssessment,
  checkTone,
  checkWords,
  coverageText,
  dtiText,
  figureText,
  limitWords,
  ratioText,
  rerunFormFrom,
  rerunPayload,
  type RerunForm,
} from "./assessment-view";
import type { Assessment, AssessmentFigures } from "@/types/loan-origination";

const figures: AssessmentFigures = {
  declared_monthly_income: 30000,
  verified_monthly_income: 28000.5,
  eligible_monthly_income: 28000.5,
  monthly_expenses: 12000,
  outside_debt_payments: 1500,
  lendy_debt_payments: 2000,
  monthly_debt_payments: 3500,
  disposable_income: 12500.5,
  proposed_monthly_installment: 5200,
  dti_ratio: 40.01,
  coverage_ratio: 2.4,
  remaining_income: 7300.5,
};

const assessment = (patch: Partial<Assessment> = {}): Pick<Assessment, "figures" | "member_figures_hidden"> => ({
  figures,
  member_figures_hidden: false,
  ...patch,
});

test("ratios read exactly as the server sends them: two decimals, never rounded again", () => {
  assert.equal(ratioText(40.01), "40.01");
  assert.equal(ratioText(40.1), "40.10");
  assert.equal(ratioText(40), "40.00");
  assert.equal(ratioText(1.24), "1.24");
  assert.equal(ratioText(-0.5), "-0.50");
  assert.equal(ratioText(null), null);
  // A failing 40.004% reaches the browser as 40.01 (rounded up on the server); #615 showed it as 40%.
  assert.equal(dtiText(assessment()), "40.01%");
  assert.equal(coverageText(assessment()), "2.40");
});

test("figures that count a linked member's loans read Withheld, never ₱0.00 or a dash", () => {
  const hidden = assessment({
    member_figures_hidden: true,
    figures: { ...figures, lendy_debt_payments: null, monthly_debt_payments: null, disposable_income: null, dti_ratio: null, coverage_ratio: null, remaining_income: null },
  });
  assert.equal(dtiText(hidden), "Withheld");
  assert.equal(coverageText(hidden), "Withheld");
  assert.equal(figureText(hidden, "remaining_income"), "Withheld");
  assert.equal(figureText(hidden, "lendy_debt_payments"), "Withheld");
  // The applicant's own figures stay.
  assert.equal(figureText(hidden, "proposed_monthly_installment"), "₱5,200.00");
  assert.equal(figureText(hidden, "outside_debt_payments"), "₱1,500.00");
  assert.match(WITHHELD_SENTENCE, /withheld/);
  assert.match(WITHHELD_SENTENCE, /view loans/);
});

test("a figure the server didn't work out reads as a dash; a zero reads ₱0.00", () => {
  const partial = assessment({ figures: { ...figures, verified_monthly_income: null, remaining_income: 0, dti_ratio: null } });
  assert.equal(figureText(partial, "verified_monthly_income"), "—");
  assert.equal(figureText(partial, "remaining_income"), "₱0.00");
  assert.equal(dtiText(partial), "—");
});

test("each limit is coloured by the server's own check, never by a comparison in the browser", () => {
  assert.equal(checkTone(true), "success");
  assert.equal(checkTone(false), "danger");
  assert.equal(checkTone(null), "neutral");
  assert.equal(checkWords(true), "Passes");
  assert.equal(checkWords(false), "Fails");
  assert.equal(checkWords(null), "Not worked out");
});

test("limits read as the server stores them, decimals kept", () => {
  const limits = { max_dti: 40, min_coverage: 1.25, min_remaining_income: 0 };
  assert.equal(limitWords("dti", limits), "at most 40%");
  assert.equal(limitWords("coverage", limits), "at least 1.25");
  assert.equal(limitWords("remaining_income", limits), "at least ₱0.00");
  assert.equal(limitWords("dti", { ...limits, max_dti: 37.5 }), "at most 37.5%");
});

const form = (patch: Partial<RerunForm> = {}): RerunForm => ({
  verifiedIncome: "",
  lastIncome: "",
  verifiedDebt: "",
  lastDebt: "",
  startDate: "",
  ...patch,
});

test("a run sends only the figures entered, as exact strings", () => {
  assert.deepEqual(rerunPayload(form()), { payload: {}, problems: [] });
  assert.deepEqual(rerunPayload(form({ verifiedIncome: "₱25,000.50", verifiedDebt: " 1500 ", startDate: "2026-12-01" })), {
    payload: { verified_monthly_income: "25000.50", verified_debt_payments: "1500", start_date: "2026-12-01" },
    problems: [],
  });
  // Never through a float, which can't hold 9999999999999.99 exactly.
  assert.equal(rerunPayload(form({ verifiedIncome: "9999999999999.99" })).payload.verified_monthly_income, "9999999999999.99");
});

const verified = (income: string | null, debt: string | null) =>
  ({ verified_inputs: { monthly_income: income, debt_payments: debt } }) as Assessment;

test("the run dialog opens on the last run's verified figures, as the server sent them", () => {
  assert.deepEqual(rerunFormFrom(verified("25000.50", null)), {
    verifiedIncome: "25000.50",
    lastIncome: "25000.50",
    verifiedDebt: "",
    lastDebt: "",
    startDate: "",
  });
  // A first run has nothing to keep.
  assert.deepEqual(rerunFormFrom(null), form());
  // A server that doesn't send verified_inputs yet: the last figures are unknown.
  assert.deepEqual(rerunFormFrom({} as Assessment), form({ lastIncome: null, lastDebt: null }));
});

test("a prefilled figure left as it is keeps the last run's: nothing is sent for it", () => {
  assert.deepEqual(rerunPayload(rerunFormFrom(verified("25000.50", "1500.00"))), { payload: {}, problems: [] });
});

test("emptying a prefilled figure clears it: null, so the declared figure counts again", () => {
  const last = rerunFormFrom(verified("25000.50", "1500.00"));
  assert.deepEqual(rerunPayload({ ...last, verifiedIncome: "  " }), { payload: { verified_monthly_income: null }, problems: [] });
  assert.deepEqual(rerunPayload({ ...last, verifiedDebt: "", verifiedIncome: "30000" }), {
    payload: { verified_monthly_income: "30000", verified_debt_payments: null },
    problems: [],
  });
});

test("a blank figure with nothing verified before, or with the last one unknown, sends nothing", () => {
  assert.deepEqual(rerunPayload(form({ lastIncome: "", lastDebt: "" })), { payload: {}, problems: [] });
  assert.deepEqual(rerunPayload(form({ lastIncome: null, lastDebt: null })), { payload: {}, problems: [] });
});

test("an amount that isn't pesos with at most two decimals is caught before the round trip", () => {
  assert.deepEqual(rerunPayload(form({ verifiedIncome: "25000.505" })).problems, [
    "Enter the verified monthly income with at most two decimals.",
  ]);
  assert.deepEqual(rerunPayload(form({ verifiedDebt: "abc" })).problems, [
    "Enter the verified monthly debt payments as an amount in pesos, like 25000.",
  ]);
  assert.deepEqual(rerunPayload(form({ verifiedIncome: "-5" })).problems, [
    "The verified monthly income can't be below ₱0.00.",
  ]);
  assert.deepEqual(rerunPayload(form({ startDate: "12/01/2026" })).problems, [
    "Enter the start date as a date, like 2026-11-19.",
  ]);
});

test("only an application under review and not handed off can be assessed", () => {
  assert.deepEqual([...ASSESSABLE_STATUSES], ["submitted", "document_verification", "additional_info_required", "under_assessment"]);
  assert.equal(canRunAssessment({ status: "under_assessment", loan_id: null }), true);
  assert.equal(canRunAssessment({ status: "under_assessment", loan_id: 3 }), false);
  assert.equal(canRunAssessment({ status: "pending_approval", loan_id: null }), false);
  assert.equal(canRunAssessment({ status: "draft", loan_id: null }), false);
});
