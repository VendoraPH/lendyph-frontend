import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_ACCOUNT_MAPPING_CODES,
  seedNormalBalance,
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

test("the contra accounts are the allowance and accumulated depreciation", () => {
  const contra = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.is_contra).map((a) => a.code);
  assert.deepEqual(contra.sort(), ["1200", "1490"]);
});

test("a contra asset is credit-normal", () => {
  const allowance = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === "1200")!;
  assert.equal(seedNormalBalance(allowance), "credit");
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
