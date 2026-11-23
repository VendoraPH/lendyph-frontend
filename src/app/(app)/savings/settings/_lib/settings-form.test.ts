import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsSettings } from "@/types";
import { companyWideBlocker, companyWideMissing } from "@/lib/savings/company-wide";
import {
  prepareBooksBlocker,
  prepareBooksSummary,
  readNoticeDays,
  readSettingsDraft,
  readTaxRule,
  settingsEditBlocker,
  toSettingsDraft,
} from "./settings-form";

const SETTINGS: SavingsSettings = {
  tier1_limit: "10000.00",
  tier2_limit: "50000.00",
  tier3_checkers: 2,
  dormancy_months: 24,
  large_transaction_alert: "500000.00",
  notice_days: [30, 15, 7, 3, 0],
  dormancy_warning_days: 60,
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
    notice_days: [30, 15, 7, 3, 0],
    dormancy_warning_days: 60,
  });
});

test("the maturity notice days and the dormancy warning show as the server sends them", () => {
  const draft = toSettingsDraft(SETTINGS);
  assert.equal(draft.noticeDays, "30, 15, 7, 3, 0");
  assert.equal(draft.warningDays, "60");
  assert.equal(toSettingsDraft({ ...SETTINGS, notice_days: [] }).noticeDays, "");
});

test("notice days are whole days from 0 (the maturity day) to 365, each once, up to 10, as the server checks them", () => {
  assert.deepEqual(readNoticeDays("30, 15, 7, 3, 0"), [30, 15, 7, 3, 0]);
  assert.deepEqual(readNoticeDays(" 60 30,7 "), [60, 30, 7]);
  assert.deepEqual(readNoticeDays("365,0"), [365, 0]);
  assert.deepEqual(readNoticeDays("1, 2, 3, 4, 5, 6, 7, 8, 9, 10"), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(readNoticeDays("1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11"), null, "more than 10");
  assert.equal(readNoticeDays("366"), null);
  assert.equal(readNoticeDays("-1"), null);
  assert.equal(readNoticeDays("7.5"), null);
  assert.equal(readNoticeDays("7, 07"), null, "each once");
  assert.equal(readNoticeDays("thirty"), null);
});

test("blank notice days send none, which the server takes", () => {
  assert.deepEqual(readNoticeDays("  "), []);
  const { input, problems } = readSettingsDraft({ ...toSettingsDraft(SETTINGS), noticeDays: "" });
  assert.deepEqual(problems, []);
  assert.deepEqual(input.notice_days, []);
});

test("a bad notice list or dormancy warning is named before anything is sent", () => {
  const draft = toSettingsDraft(SETTINGS);
  assert.deepEqual(readSettingsDraft({ ...draft, noticeDays: "30, 30", warningDays: "400" }).problems, [
    "Maturity notice days (0 to 365, each once, up to 10)",
    "Dormancy warning days (0 to 365)",
  ]);
  assert.deepEqual(readSettingsDraft({ ...draft, warningDays: "" }).problems, ["Dormancy warning days (0 to 365)"]);
  assert.deepEqual(readSettingsDraft({ ...draft, warningDays: "0" }).input.dormancy_warning_days, 0);
});

test("blank or over-precise amounts, fewer than two approvers and no dormancy are named", () => {
  const { problems } = readSettingsDraft({
    tier1: "",
    tier2: "50000.555",
    checkers: "1",
    dormancy: "0",
    alert: "1",
    noticeDays: "30, 15, 7, 3, 0",
    warningDays: "60",
  });
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

test("the settings card takes edits only with savings:settings and branches:view_all, as the server's PUT does, and says which is missing", () => {
  const holding = (...held: string[]) => (p: string) => held.includes(p);
  assert.equal(settingsEditBlocker(holding("savings:settings", "branches:view_all")), null);
  assert.match(settingsEditBlocker(holding("savings:settings", "savings:view")) ?? "", /every branch, so changing them needs access to all branches/);
  assert.match(settingsEditBlocker(holding("savings:view", "branches:view_all")) ?? "", /needs the Savings configure permission/);
  assert.match(settingsEditBlocker(holding("savings:view")) ?? "", /needs the Savings configure permission/);
});

test("the settings card and the books set-up follow the one company-wide savings rule", () => {
  const holding = (...held: string[]) => (p: string) => held.includes(p);
  const holders = [[], ["savings:view"], ["savings:settings"], ["branches:view_all"], ["savings:settings", "branches:view_all"]];
  for (const held of holders) {
    const can = holding(...held);
    assert.equal(settingsEditBlocker(can), companyWideBlocker(can, "settings"), held.join(", "));
    assert.equal(prepareBooksBlocker(can) === null, companyWideMissing(can) === null, held.join(", "));
  }
});
