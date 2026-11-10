import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsSettings } from "@/types";
import { prepareBooksBlocker, prepareBooksSummary, readSettingsDraft, readTaxRule, toSettingsDraft } from "./settings-form";

const SETTINGS: SavingsSettings = {
  tier1_limit: "10000.00",
  tier2_limit: "50000.00",
  tier3_checkers: 2,
  dormancy_months: 24,
  large_transaction_alert: "500000.00",
  current_tax_rates: { member: "0.0000", non_member: "20.0000" },
  tax_rules: [],
};

test("the server's settings round-trip unchanged, amounts as two-decimal text", () => {
  const { input, problems } = readSettingsDraft(toSettingsDraft(SETTINGS));
  assert.deepEqual(problems, []);
  assert.deepEqual(input, {
    tier1_limit: "10000.00",
    tier2_limit: "50000.00",
    tier3_checkers: 2,
    dormancy_months: 24,
    large_transaction_alert: "500000.00",
  });
});

test("blank or over-precise amounts, fewer than two approvers and no dormancy are named", () => {
  const { problems } = readSettingsDraft({ tier1: "", tier2: "50000.555", checkers: "1", dormancy: "0", alert: "1" });
  assert.deepEqual(problems, [
    "Approval needed above",
    "Two approvers needed above",
    "Approvers above the second amount (2)",
    "Dormant after (months)",
  ]);
});

test("a tax rule takes effect today or later, with its rate as typed", () => {
  const ok = readTaxRule("member", "0.5", "2026-11-10", "2026-11-10");
  assert.deepEqual(ok, { input: { holder_type: "member", rate: "0.5", effective_from: "2026-11-10" }, problems: [] });
  assert.deepEqual(readTaxRule("non_member", "20", "2026-11-09", "2026-11-10").problems, ["Effective from (today or later)"]);
  assert.equal(readTaxRule("member", "abc", "2026-11-10", "2026-11-10").problems.length, 1);
});

test("setting up the books reads back the server's own sentences, grouped, empty groups left out", () => {
  const summary = prepareBooksSummary({
    books_ready: true,
    books_missing: [],
    added: ["Added 5160 Interest Expense on Deposits."],
    mapped: ["Savings deposits now posts to 2050 Savings Deposits."],
    unchanged: [],
    skipped: [],
  });
  assert.deepEqual(summary, [
    { heading: "Added to the chart", lines: ["Added 5160 Interest Expense on Deposits."] },
    { heading: "Posting roles mapped", lines: ["Savings deposits now posts to 2050 Savings Deposits."] },
  ]);
  const stillMissing = prepareBooksSummary({ books_ready: false, books_missing: ["Time deposits has no account."] });
  assert.deepEqual(stillMissing, [{ heading: "Still missing", lines: ["Time deposits has no account."] }]);
  assert.deepEqual(prepareBooksSummary({}), []);
});

test("the set-up button needs savings:settings and branches:view_all, and says which is missing", () => {
  const holding = (...held: string[]) => (p: string) => held.includes(p);
  assert.equal(prepareBooksBlocker(holding("savings:settings", "branches:view_all")), null);
  assert.match(prepareBooksBlocker(holding("savings:settings")) ?? "", /all branches/);
  assert.match(prepareBooksBlocker(holding("branches:view_all")) ?? "", /configure/);
});
