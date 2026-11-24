import { test } from "node:test";
import assert from "node:assert/strict";
import { ladderLines, rateTermLabel, readRateDraft, readTierDraft, tierLabel } from "./rate-draft";

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

test("a ladder is sent base tier first, with null as its minimum, minimums as two-decimal text and rates as typed", () => {
  const { input, problems } = readTierDraft(
    {
      baseRate: "0.5000",
      tiers: [
        { minBalance: "10000", rate: "1.25" },
        { minBalance: "50000.5", rate: "2.5" },
      ],
      effectiveFrom: "2026-12-01",
    },
    TODAY,
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(input, {
    tiers: [
      { min_balance: null, annual_rate: "0.5000" },
      { min_balance: "10000.00", annual_rate: "1.25" },
      { min_balance: "50000.50", annual_rate: "2.5" },
    ],
    effective_from: "2026-12-01",
  });
});

test("blank tier rows are left out, so a ladder with only its base tier is one rate", () => {
  const { input, problems } = readTierDraft(
    { baseRate: "1", tiers: [{ minBalance: "", rate: "" }], effectiveFrom: TODAY },
    TODAY,
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(input.tiers, [{ min_balance: null, annual_rate: "1" }]);
});

test("a tier needs a minimum above ₱0.00 and a rate; the base rate and the date are checked too", () => {
  const { problems } = readTierDraft(
    {
      baseRate: "",
      tiers: [
        { minBalance: "0", rate: "1" },
        { minBalance: "5000", rate: "" },
        { minBalance: "1.999", rate: "2" },
      ],
      effectiveFrom: "2026-11-01",
    },
    TODAY,
  );
  assert.ok(problems.some((p) => p.startsWith("Base rate")));
  assert.ok(problems.includes("Tier 1: minimum balance above ₱0.00"));
  assert.ok(problems.some((p) => p.startsWith("Tier 2: annual rate")));
  assert.ok(problems.includes("Tier 3: minimum balance above ₱0.00"));
  assert.ok(problems.includes("Effective from (today or later)"));
});

test("a ladder holds at most 20 tiers in all", () => {
  const tiers = Array.from({ length: 20 }, (_, i) => ({ minBalance: String((i + 1) * 1000), rate: "1" }));
  const { problems } = readTierDraft({ baseRate: "0.5", tiers, effectiveFrom: TODAY }, TODAY);
  assert.ok(problems.includes("At most 20 tiers, the base rate included"));
});

test("a ladder reads in words: the base tier below the first tier, the others from their minimum up", () => {
  assert.equal(tierLabel(null), "Any balance");
  assert.equal(tierLabel("50000.00"), "₱50,000.00 and up");
  assert.deepEqual(
    ladderLines([
      { min_balance: null, annual_rate: "0.5000" },
      { min_balance: "10000.00", annual_rate: "1.2500" },
      { min_balance: "50000.00", annual_rate: "2.0000" },
    ]),
    ["Below ₱10,000.00: 0.5% a year", "₱10,000.00 and up: 1.25% a year", "₱50,000.00 and up: 2% a year"],
  );
  assert.deepEqual(ladderLines([{ min_balance: null, annual_rate: "1.1250" }]), ["Any balance: 1.125% a year"]);
  assert.deepEqual(ladderLines([]), []);
});
