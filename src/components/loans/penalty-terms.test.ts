import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bracketLine, bracketRangeLabel, penaltyTermLines } from "./penalty-terms";

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

test("the loan page shows the penalty terms only while penalty configurations are on", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  assert.match(page, /\{env\.features\.penaltyConfigs && \(\s*<div>\s*<p className="text-xs text-muted-foreground">Penalty<\/p>\s*<PenaltyTerms loan=\{loan\}/);
  assert.equal(page.match(/<PenaltyTerms /g)?.length, 1);
});
