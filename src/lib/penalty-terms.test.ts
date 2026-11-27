import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bracketLine,
  bracketRangeLabel,
  penaltyClauseText,
  penaltyShortText,
  penaltyTermLines,
  readDocumentPenaltyTerms,
} from "./penalty-terms";

test("a loan with brackets reads one line per bracket", () => {
  assert.deepEqual(
    penaltyTermLines({
      penalty_rate: 0,
      penalty_brackets: [
        { days_from: 1, days_to: 5, rate: 20 },
        { days_from: 6, days_to: 10, rate: 30 },
        { days_from: 11, days_to: null, rate: 50 },
      ],
      penalty_config_name: "Standard Loan Penalty",
    }),
    ["1–5 days late: 20%", "6–10 days late: 30%", "11 days or more: 50%"],
  );
});

test("a loan with a monthly rate reads it as a month's rate, never rounded", () => {
  assert.deepEqual(penaltyTermLines({ penalty_rate: 3, penalty_brackets: null }), ["3% a month"]);
  assert.deepEqual(penaltyTermLines({ penalty_rate: "1.1250" as unknown as number }), ["1.125% a month"]);
});

test("a loan with neither reads No penalty", () => {
  assert.deepEqual(penaltyTermLines({ penalty_rate: 0, penalty_brackets: [] }), ["No penalty"]);
  assert.deepEqual(penaltyTermLines({}), ["No penalty"]);
});

test("ranges read in words", () => {
  assert.equal(bracketRangeLabel({ days_from: 1, days_to: 5 }), "1–5 days");
  assert.equal(bracketRangeLabel({ days_from: 1, days_to: 1 }), "1 day");
  assert.equal(bracketRangeLabel({ days_from: 4, days_to: 4 }), "4 days");
  assert.equal(bracketRangeLabel({ days_from: 1, days_to: null }), "1 day or more");
  assert.equal(bracketLine({ days_from: 2, days_to: 2, rate: 12.5 }), "2 days late: 12.5%");
});

// ---------------------------------------------------------------------------
// The promissory note's and disclosure's penalty wording (for the owner to
// review). Each case reads the loan's own terms as the server sent them.
// ---------------------------------------------------------------------------

const BRACKETS = [
  { days_from: 1, days_to: 30, rate: 3 },
  { days_from: 31, days_to: 60, rate: 4 },
  { days_from: 61, days_to: null, rate: 5 },
];

test("document terms are read off the payload, grace absent as none", () => {
  assert.deepEqual(readDocumentPenaltyTerms({ penalty_rate: 3, grace_period_days: 3 }), {
    penaltyRate: 3,
    brackets: null,
    graceDays: 3,
  });
  assert.deepEqual(
    readDocumentPenaltyTerms({ penalty_rate: "0", penalty_brackets: BRACKETS, grace_period_days: null }),
    { penaltyRate: 0, brackets: BRACKETS, graceDays: 0 },
  );
  // Nothing about the penalty was sent: the terms are unknown, not "none".
  assert.equal(readDocumentPenaltyTerms({ grace_period_days: 3 }), null);
  assert.equal(readDocumentPenaltyTerms(null), null);
});

test("clause: a fixed rate is charged on the late instalment's unpaid principal, then monthly", () => {
  assert.equal(
    penaltyClauseText({ penaltyRate: 3, brackets: null, graceDays: 3 }),
    "If any installment is not paid in full within 3 days after its due date, a penalty of 3% of " +
      "the unpaid principal of that installment shall be charged when the grace period ends, and " +
      "again on each monthly anniversary of its due date while it remains unpaid.",
  );
  assert.match(
    penaltyClauseText({ penaltyRate: 1.125, brackets: null, graceDays: 1 }),
    /^If any installment is not paid in full within 1 day after its due date, a penalty of 1\.125% /,
  );
});

test("clause: day ranges list each range, each charge at the rate for the days late", () => {
  assert.equal(
    penaltyClauseText({ penaltyRate: 0, brackets: BRACKETS, graceDays: 3 }),
    "If any installment is not paid in full within 3 days after its due date, a penalty on the " +
      "unpaid principal of that installment shall be charged when the grace period ends, and again " +
      "on each monthly anniversary of its due date while it remains unpaid, each charge at the rate " +
      "for the number of days the installment is late: 1–30 days late: 3%; 31–60 days late: 4%; " +
      "61 days or more: 5%.",
  );
});

test("clause: no penalty says so", () => {
  const none = "No penalty is charged on late installments.";
  assert.equal(penaltyClauseText({ penaltyRate: 0, brackets: null, graceDays: 3 }), none);
  assert.equal(penaltyClauseText({ penaltyRate: 0, brackets: [], graceDays: 0 }), none);
  assert.equal(
    penaltyClauseText({ penaltyRate: 2, brackets: [{ days_from: 1, days_to: null, rate: 0 }], graceDays: 0 }),
    none,
    "a configuration that charges 0% on every day charges nothing, whatever the stored rate",
  );
});

test("clause: with no grace, the first charge falls the day after the due date", () => {
  assert.equal(
    penaltyClauseText({ penaltyRate: 3, brackets: null, graceDays: 0 }),
    "If any installment is not paid in full on its due date, a penalty of 3% of the unpaid " +
      "principal of that installment shall be charged on the day after its due date, and again on " +
      "each monthly anniversary of its due date while it remains unpaid.",
  );
  assert.match(
    penaltyClauseText({ penaltyRate: 0, brackets: BRACKETS, graceDays: 0 }),
    /^If any installment is not paid in full on its due date, a penalty on the unpaid principal of that installment shall be charged on the day after its due date, /,
  );
});

test("short form: the disclosure's one line, for each case", () => {
  assert.equal(
    penaltyShortText({ penaltyRate: 3, brackets: null, graceDays: 3 }),
    "3% of a late installment's unpaid principal, charged after a 3-day grace period and again each month it stays unpaid",
  );
  assert.equal(
    penaltyShortText({ penaltyRate: 0, brackets: BRACKETS, graceDays: 1 }),
    "1–30 days late: 3%; 31–60 days late: 4%; 61 days or more: 5%, of a late installment's unpaid " +
      "principal, charged after a 1-day grace period and again each month it stays unpaid",
  );
  assert.equal(
    penaltyShortText({ penaltyRate: 3, brackets: null, graceDays: 0 }),
    "3% of a late installment's unpaid principal, charged the day after its due date and again each month it stays unpaid",
  );
  assert.equal(penaltyShortText({ penaltyRate: 0, brackets: null, graceDays: 3 }), "None");
});
