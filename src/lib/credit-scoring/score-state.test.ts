import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DETAILS_HIDDEN_NOTE,
  INSUFFICIENT_DATA_MESSAGE,
  NOT_SCORED_MESSAGE,
  advisoryLine,
  averageScoreText,
  categoryDataNote,
  countOrDash,
  isDetailsHidden,
  otherBranchLoansNote,
  rowScoreView,
  scoreSections,
  scoreView,
  showsLimitedHistory,
} from "./score-state";
import type { CreditScore } from "@/types/credit-scoring";

function score(over: Partial<CreditScore> = {}): CreditScore {
  return {
    id: 1,
    borrower_id: 4,
    borrower_name: "Ana Cruz",
    borrower_code: "M-0004",
    score_type: "behavioral",
    score: 72,
    risk_level: "moderate",
    confidence: "medium",
    model_version: "1.0",
    category_breakdown: [],
    factors: [],
    recommendation: "Standard review.",
    calculated_at: "2026-11-09T00:45:00+08:00",
    status: "scored",
    limited_history: false,
    confidence_reason: null,
    validated: false,
    previous_score: null,
    context: "nightly",
    loan_id: null,
    factors_without_data: [],
    financials_hidden: false,
    capacity: null,
    data_used: null,
    ...over,
  };
}

test("a scored profile shows its score and band", () => {
  assert.deepEqual(scoreView(score()), { kind: "scored", score: 72, riskLevel: "moderate" });
});

test("not_scored reads 'Not scored yet' with no figures", () => {
  const view = scoreView(
    score({ status: "not_scored", id: null, score: null, risk_level: null, confidence: null, model_version: null }),
  );
  assert.deepEqual(view, { kind: "not_scored", message: NOT_SCORED_MESSAGE });
  assert.equal(NOT_SCORED_MESSAGE, "Not scored yet");
});

test("insufficient_data has no score, band or 0", () => {
  const view = scoreView(score({ status: "insufficient_data", score: null, risk_level: null }));
  assert.deepEqual(view, { kind: "insufficient_data", message: INSUFFICIENT_DATA_MESSAGE });
  assert.equal(INSUFFICIENT_DATA_MESSAGE, "Insufficient data: no repayment or capacity data");
  assert.doesNotMatch(JSON.stringify(view), /\b0\b/);
});

test("a list row with insufficient data reads 'Insufficient data' where the score goes", () => {
  assert.deepEqual(rowScoreView({ status: "insufficient_data", score: null, risk_level: null }), {
    kind: "insufficient_data",
    message: "Insufficient data",
  });
  assert.deepEqual(rowScoreView({ status: "scored", score: 81, risk_level: "low" }), {
    kind: "scored",
    score: 81,
    riskLevel: "low",
  });
});

test("every score carries the advisory line with its scorecard version", () => {
  assert.equal(
    advisoryLine(score({ model_version: "1.1", validated: false })),
    "Advisory only, never changes a loan. Scorecard v1.1, not yet validated.",
  );
  assert.equal(
    advisoryLine(score({ model_version: "2.0", validated: true })),
    "Advisory only, never changes a loan. Scorecard v2.0.",
  );
  assert.equal(advisoryLine(score({ status: "not_scored", model_version: null, validated: null })), null);
});

test("limited history shows only on a scored profile that has it", () => {
  assert.equal(showsLimitedHistory(score({ limited_history: true })), true);
  assert.equal(showsLimitedHistory(score({ limited_history: false })), false);
  assert.equal(showsLimitedHistory(score({ limited_history: true, status: "insufficient_data" })), false);
});

test("a category without data reads 'No data'", () => {
  assert.equal(categoryDataNote({ has_data: false }), "No data");
  assert.equal(categoryDataNote({ has_data: true }), null);
});

test("loans at branches the caller can't see are counted, never filled in", () => {
  assert.equal(otherBranchLoansNote(null), null);
  assert.equal(otherBranchLoansNote({ loan_ids: [1], branch_ids: [1], other_branch_loans: 0 }), null);
  assert.equal(
    otherBranchLoansNote({ loan_ids: [], branch_ids: [], other_branch_loans: 1 }),
    "1 loan at a branch you can't see is left out.",
  );
  assert.equal(
    otherBranchLoansNote({ loan_ids: [3], branch_ids: [2], other_branch_loans: 4 }),
    "4 loans at branches you can't see are left out.",
  );
});

test("a missing average reads a dash, never 0.0", () => {
  assert.equal(averageScoreText(null), "—");
  assert.equal(averageScoreText(72.5), "72.5");
  assert.equal(averageScoreText(0), "0");
});

/** The summary-only score: the detail keys absent, the lists empty. */
function summaryOnly(over: Partial<CreditScore> = {}): CreditScore {
  const full: Partial<CreditScore> = {
    ...score({ recommendation: "Manual review required." }),
    category_breakdown: [],
    factors: [],
    factors_without_data: [],
    financials_hidden: true,
    details_hidden: true,
    ...over,
  };
  delete full.confidence;
  delete full.confidence_reason;
  delete full.capacity;
  delete full.data_used;
  return full as CreditScore;
}

test("a summary-only score shows one notice in place of its breakdown and factors", () => {
  assert.equal(DETAILS_HIDDEN_NOTE, "Details need access to this member's details");
  assert.deepEqual(scoreSections(summaryOnly()), { kind: "hidden", note: DETAILS_HIDDEN_NOTE });
  assert.deepEqual(scoreSections(summaryOnly({ status: "not_scored", score: null, risk_level: null })), {
    kind: "hidden",
    note: DETAILS_HIDDEN_NOTE,
  });
  assert.deepEqual(scoreView(summaryOnly()), { kind: "scored", score: 72, riskLevel: "moderate" });
  assert.equal(otherBranchLoansNote(summaryOnly().data_used), null);
});

test("a page hides the details when the score, the assessment or the flags answer say so", () => {
  assert.equal(isDetailsHidden(summaryOnly()), true);
  assert.equal(isDetailsHidden(score()), false);
  assert.equal(isDetailsHidden(score({ details_hidden: false }), { details_hidden: true }), true);
  assert.equal(isDetailsHidden(null, undefined, {}), false);
  assert.deepEqual(scoreSections(score(), true), { kind: "hidden", note: DETAILS_HIDDEN_NOTE });
});

test("a full score shows its sections, and an absent list reads as empty", () => {
  const factor = { id: 1, label: "On time", detail: "All paid", impact: "positive" as const, category: "History" };
  assert.deepEqual(scoreSections(score({ factors: [factor] })), {
    kind: "shown",
    breakdown: [],
    withoutData: [],
    factors: [factor],
  });
  const bare = score();
  delete (bare as Partial<CreditScore>).factors;
  delete (bare as Partial<CreditScore>).category_breakdown;
  delete (bare as Partial<CreditScore>).factors_without_data;
  assert.deepEqual(scoreSections(bare), { kind: "shown", breakdown: [], withoutData: [], factors: [] });
  assert.deepEqual(scoreSections(score({ status: "not_scored" })), { kind: "none" });
});

test("a null or missing count reads a dash, never 0", () => {
  assert.equal(countOrDash(null), "—");
  assert.equal(countOrDash(undefined), "—");
  assert.equal(countOrDash(0), "0");
  assert.equal(countOrDash(3), "3");
});
