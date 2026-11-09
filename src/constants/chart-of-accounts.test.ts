import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_ACCOUNT_MAPPING_CODES,
  COOPERATIVE_CHART_ADDITIONS,
  COOPERATIVE_MAPPING_OVERRIDES,
  seedNormalBalance,
  templateChart,
} from "./chart-of-accounts";
import { accountTypeFromCode } from "@/lib/accounting/account";

const CODES = new Set(DEFAULT_CHART_OF_ACCOUNTS.map((a) => a.code));

test("every account code is unique", () => {
  assert.equal(CODES.size, DEFAULT_CHART_OF_ACCOUNTS.length);
});

test("every account's type agrees with its code range", () => {
  // The whole classification system reads the leading digit. A row filed under
  // the wrong prefix would land on the wrong financial statement.
  for (const seed of DEFAULT_CHART_OF_ACCOUNTS) {
    assert.equal(
      accountTypeFromCode(seed.code),
      seed.type,
      `${seed.code} ${seed.name} is typed "${seed.type}"`
    );
  }
});

test("every parent reference points at an account that exists", () => {
  for (const seed of DEFAULT_CHART_OF_ACCOUNTS) {
    if (!seed.parent) continue;
    assert.ok(
      CODES.has(seed.parent),
      `${seed.code} ${seed.name} names a missing parent ${seed.parent}`
    );
  }
});

test("a child never sits under a parent of a different type", () => {
  const byCode = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
  for (const seed of DEFAULT_CHART_OF_ACCOUNTS) {
    if (!seed.parent) continue;
    assert.equal(
      byCode.get(seed.parent)!.type,
      seed.type,
      `${seed.code} ${seed.name} sits under a parent of another type`
    );
  }
});

test("every parent is actually marked as a group", () => {
  // Posting is blocked on `is_group`, so a parent left unflagged would accept
  // entries and double-count its own children.
  const byCode = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
  const parents = new Set(
    DEFAULT_CHART_OF_ACCOUNTS.map((a) => a.parent).filter(Boolean) as string[]
  );
  for (const code of parents) {
    assert.equal(byCode.get(code)!.is_group, true, `${code} has children but is not a group`);
  }
});

test("each of the five sections has a top-level heading", () => {
  for (const code of ["1000", "2000", "3000", "4000", "5000"]) {
    const seed = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === code);
    assert.ok(seed, `missing heading ${code}`);
    assert.equal(seed!.is_group, true);
    assert.equal(seed!.parent, undefined);
  }
});

test("the contra accounts are the allowance, unearned restructure income and accumulated depreciation", () => {
  const contra = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.is_contra).map((a) => a.code);
  assert.deepEqual(contra.sort(), ["1200", "1210", "1490"]);
});

test("a contra asset is credit-normal", () => {
  for (const code of ["1200", "1210"]) {
    const seed = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === code)!;
    assert.equal(seedNormalBalance(seed), "credit", code);
  }
});

test("a plain asset is debit-normal and a plain income account credit-normal", () => {
  const cash = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === "1010")!;
  const interest = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === "4010")!;
  assert.equal(seedNormalBalance(cash), "debit");
  assert.equal(seedNormalBalance(interest), "credit");
});

test("every posting role maps to an account in the chart", () => {
  // A mapping pointing at a code that does not exist would fail at the moment
  // a loan is released, which is the worst possible time to find out.
  for (const [role, code] of Object.entries(DEFAULT_ACCOUNT_MAPPING_CODES)) {
    assert.ok(CODES.has(code), `mapping "${role}" points at missing account ${code}`);
  }
});

test("no posting role maps to a group heading", () => {
  const byCode = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
  for (const [role, code] of Object.entries(DEFAULT_ACCOUNT_MAPPING_CODES)) {
    assert.notEqual(
      byCode.get(code)!.is_group,
      true,
      `mapping "${role}" points at heading ${code}, which cannot be posted to`
    );
  }
});

test("the money accounts are the four settlement methods", () => {
  const cashAccounts = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.cash_kind);
  assert.deepEqual(
    cashAccounts.map((a) => a.cash_kind).sort(),
    ["bank", "cash", "gcash", "maya"]
  );
});

test("every settlement method in the mapping is a money account", () => {
  const byCode = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
  for (const method of ["cash", "gcash", "maya", "bank"] as const) {
    const code = DEFAULT_ACCOUNT_MAPPING_CODES[method];
    assert.equal(byCode.get(code)!.cash_kind, method);
  }
});

test("each release-deduction role defaults to the account the backend seeds, of the type it must be", () => {
  const byCode = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
  const expected = {
    service_fee_income: ["4040", "Service Fee Income", "income"],
    notarial_fees_payable: ["2030", "Notarial Fees Payable", "liability"],
    insurance_premium_payable: ["2040", "Insurance Premium Payable", "liability"],
    share_capital: ["3060", "Share Capital", "equity"],
    other_fee_income: ["4080", "Other Fee Income", "income"],
  } as const;
  for (const [role, [code, name, type]] of Object.entries(expected)) {
    assert.equal(DEFAULT_ACCOUNT_MAPPING_CODES[role as keyof typeof expected], code, role);
    const seed = byCode.get(code)!;
    assert.equal(seed.name, name, role);
    assert.equal(seed.type, type, role);
  }
});

test("each tax role defaults to the payable account the backend seeds under 2200 Taxes Payable", () => {
  const byCode = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
  const expected = {
    documentary_stamp_tax_payable: ["2230", "Documentary Stamp Tax Payable"],
    withholding_tax_payable: ["2210", "Withholding Tax Payable"],
    other_taxes_payable: ["2220", "Other Taxes Payable"],
  } as const;
  for (const [role, [code, name]] of Object.entries(expected)) {
    assert.equal(DEFAULT_ACCOUNT_MAPPING_CODES[role as keyof typeof expected], code, role);
    const seed = byCode.get(code)!;
    assert.equal(seed.name, name, role);
    assert.equal(seed.type, "liability", role);
    assert.equal(seed.parent, "2200", role);
    assert.equal(seed.is_group ?? false, false, role);
  }
});

test("each Phase 2 posting role defaults to the account the backend seeds, of the type it must be", () => {
  const byCode = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
  const expected = {
    gcash_service_income: ["4090", "GCash Service Income", "income", "4000"],
    loan_adjustments: ["1180", "Loan Adjustments Clearing", "asset", "1000"],
    unearned_restructure_income: [
      "1210",
      "Unearned Interest and Penalty – Restructured Loans",
      "asset",
      "1000",
    ],
    net_surplus: ["3030", "Retained Earnings", "equity", "3000"],
    suspense: ["2390", "Suspense Account", "liability", "2000"],
  } as const;
  for (const [role, [code, name, type, parent]] of Object.entries(expected)) {
    assert.equal(DEFAULT_ACCOUNT_MAPPING_CODES[role as keyof typeof expected], code, role);
    const seed = byCode.get(code)!;
    assert.ok(seed, `${role} points at ${code}, which the chart lacks`);
    assert.equal(seed.name, name, role);
    assert.equal(seed.type, type, role);
    assert.equal(seed.parent, parent, role);
    assert.equal(seed.is_group ?? false, false, role);
  }
});

test("unearned restructure income is a contra asset beside the allowance, outside the loans receivable heading", () => {
  // Under 1000, not 1100: the portfolio heading sums gross receivables, and
  // the deferral must reduce them on its own line, as the allowance does.
  const unearned = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === "1210")!;
  assert.equal(unearned.is_contra, true);
  assert.equal(unearned.parent, "1000");
  const codes = DEFAULT_CHART_OF_ACCOUNTS.map((a) => a.code);
  assert.equal(codes.indexOf("1210"), codes.indexOf("1200") + 1);
});

test("insurance premium collected from payments has no receivable role: it goes to Insurance Premium Payable", () => {
  // Decision 2 (2026-11-01): the release journal is unchanged, so the owed
  // part is never booked as a receivable; a payment that collects it credits
  // 2040, the same account as the part withheld at release.
  assert.equal(
    Object.prototype.hasOwnProperty.call(DEFAULT_ACCOUNT_MAPPING_CODES, "insurance_premium_receivable"),
    false
  );
  assert.equal(DEFAULT_ACCOUNT_MAPPING_CODES.insurance_premium_payable, "2040");
});

// ── Round C: chart templates ──

// Copied from lendyph-backend `ChartOfAccountsSeeder::COOPERATIVE_ADDITIONS`
// (slice C1): code, name, parent, and whether it is a heading.
const BACKEND_COOPERATIVE_ADDITIONS = [
  ["2050", "Savings Deposits", "2000", false],
  ["2060", "Time Deposits", "2000", false],
  ["2070", "Interest on Share Capital Payable", "2000", false],
  ["2080", "Patronage Refund Payable", "2000", false],
  ["3070", "Statutory Funds", "3000", true],
  ["3071", "Reserve Fund", "3070", false],
  ["3072", "Education and Training Fund", "3070", false],
  ["3073", "Community Development Fund", "3070", false],
  ["3074", "Optional Fund", "3070", false],
  ["3080", "Undivided Net Surplus", "3000", false],
] as const;

test("the cooperative additions are the backend's ten rows, code for code and name for name", () => {
  assert.deepEqual(
    COOPERATIVE_CHART_ADDITIONS.map((a) => [a.code, a.name, a.parent, a.is_group ?? false]),
    BACKEND_COOPERATIVE_ADDITIONS.map((row) => [...row]),
  );
  for (const seed of COOPERATIVE_CHART_ADDITIONS) {
    assert.equal(seed.type, accountTypeFromCode(seed.code), seed.code);
    assert.equal(seed.is_contra ?? false, false, seed.code);
    assert.equal(seed.cash_kind, undefined, seed.code);
  }
});

test("the cooperative mapping differs only in net_surplus, which points at 3080", () => {
  assert.deepEqual(COOPERATIVE_MAPPING_OVERRIDES, { net_surplus: "3080" });
});

test("the lending company template is today's chart, unchanged", () => {
  assert.deepEqual(templateChart("lending_company"), DEFAULT_CHART_OF_ACCOUNTS);
  assert.equal(DEFAULT_CHART_OF_ACCOUNTS.some((a) => a.code === "3080"), false);
});

test("the cooperative template is today's chart plus the ten rows, in code order", () => {
  const chart = templateChart("cooperative");
  const codes = chart.map((a) => a.code);
  assert.equal(chart.length, DEFAULT_CHART_OF_ACCOUNTS.length + 10);
  assert.deepEqual(codes, [...codes].sort());
  assert.equal(new Set(codes).size, codes.length);
  for (const seed of DEFAULT_CHART_OF_ACCOUNTS) assert.ok(codes.includes(seed.code), seed.code);
  for (const seed of COOPERATIVE_CHART_ADDITIONS) assert.ok(codes.includes(seed.code), seed.code);
  // 3010-3030 stay; an admin can deactivate them.
  for (const code of ["3010", "3020", "3030"]) assert.ok(codes.includes(code), code);
});

test("the cooperative chart's parents exist, share the child's type and are headings", () => {
  const chart = templateChart("cooperative");
  const byCode = new Map(chart.map((a) => [a.code, a]));
  for (const seed of chart) {
    if (!seed.parent) continue;
    const parent = byCode.get(seed.parent);
    assert.ok(parent, `${seed.code} names a missing parent ${seed.parent}`);
    assert.equal(parent!.type, seed.type, seed.code);
    assert.equal(parent!.is_group, true, seed.parent);
  }
});

test("every cooperative posting role maps to a postable account in its chart", () => {
  const byCode = new Map(templateChart("cooperative").map((a) => [a.code, a]));
  const mapping = { ...DEFAULT_ACCOUNT_MAPPING_CODES, ...COOPERATIVE_MAPPING_OVERRIDES };
  for (const [role, code] of Object.entries(mapping)) {
    const seed = byCode.get(code);
    assert.ok(seed, `mapping "${role}" points at missing account ${code}`);
    assert.notEqual(seed!.is_group, true, `mapping "${role}" points at heading ${code}`);
  }
  assert.equal(byCode.get(mapping.net_surplus)!.name, "Undivided Net Surplus");
});
