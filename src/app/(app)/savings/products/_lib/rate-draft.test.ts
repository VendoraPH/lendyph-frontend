import { test } from "node:test";
import assert from "node:assert/strict";
import { rateTermLabel, readRateDraft } from "./rate-draft";

const REGULAR = { kind: "regular" as const, term_options_days: null };
const TD = { kind: "time_deposit" as const, term_options_days: [90, 180, 360] };
const TODAY = "2026-11-10";

test("a regular product's rate has no term and is sent exactly as typed", () => {
  const { input, problems } = readRateDraft({ termDays: "", rate: "1.1250", effectiveFrom: TODAY }, REGULAR, TODAY);
  assert.deepEqual(problems, []);
  assert.deepEqual(input, { annual_rate: "1.1250", term_days: null, effective_from: TODAY });
});

test("a time deposit rate needs one of the product's terms", () => {
  assert.deepEqual(readRateDraft({ termDays: "120", rate: "3", effectiveFrom: TODAY }, TD, TODAY).problems, ["Term"]);
  const ok = readRateDraft({ termDays: "180", rate: "3.5", effectiveFrom: "2026-12-01" }, TD, TODAY);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.input.term_days, 180);
});

test("a rate can't take effect in the past, go above 100% or carry more than four decimals", () => {
  assert.deepEqual(readRateDraft({ termDays: "", rate: "2", effectiveFrom: "2026-11-09" }, REGULAR, TODAY).problems, [
    "Effective from (today or later)",
  ]);
  assert.equal(readRateDraft({ termDays: "", rate: "100.5", effectiveFrom: TODAY }, REGULAR, TODAY).problems.length, 1);
  assert.equal(readRateDraft({ termDays: "", rate: "1.12345", effectiveFrom: TODAY }, REGULAR, TODAY).problems.length, 1);
  assert.equal(readRateDraft({ termDays: "", rate: "", effectiveFrom: TODAY }, REGULAR, TODAY).problems.length, 1);
});

test("terms read in words", () => {
  assert.equal(rateTermLabel(null), "All balances");
  assert.equal(rateTermLabel(1), "1 day");
  assert.equal(rateTermLabel(90), "90 days");
});
