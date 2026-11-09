import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountTypeFromCode,
  normalBalanceFor,
  belongsToStatement,
  isPostable,
  sortAccounts,
} from "./account";
import type { Account } from "@/types/accounting";

function account(over: Partial<Account> = {}): Account {
  return {
    id: 1,
    code: "1010",
    name: "Cash on Hand",
    type: "asset",
    normal_balance: "debit",
    is_contra: false,
    parent_id: null,
    is_group: false,
    is_active: true,
    ...over,
  };
}

test("derives the account type from the leading digit", () => {
  assert.equal(accountTypeFromCode("1010"), "asset");
  assert.equal(accountTypeFromCode("2010"), "liability");
  assert.equal(accountTypeFromCode("3010"), "equity");
  assert.equal(accountTypeFromCode("4010"), "income");
  assert.equal(accountTypeFromCode("5010"), "expense");
});

test("an unknown code range has no type rather than a wrong one", () => {
  assert.equal(accountTypeFromCode("9010"), null);
  assert.equal(accountTypeFromCode(""), null);
  assert.equal(accountTypeFromCode("abc"), null);
});

test("assets and expenses are debit-normal, the rest credit-normal", () => {
  assert.equal(normalBalanceFor("asset", false), "debit");
  assert.equal(normalBalanceFor("expense", false), "debit");
  assert.equal(normalBalanceFor("liability", false), "credit");
  assert.equal(normalBalanceFor("equity", false), "credit");
  assert.equal(normalBalanceFor("income", false), "credit");
});

test("a contra account inverts its type's normal side", () => {
  // Allowance for Credit Losses is an asset carrying a credit balance.
  assert.equal(normalBalanceFor("asset", true), "credit");
  // A contra-income account (sales discounts) is debit-normal.
  assert.equal(normalBalanceFor("income", true), "debit");
});

test("balance sheet takes assets, liabilities and equity", () => {
  assert.equal(belongsToStatement("asset"), "balance_sheet");
  assert.equal(belongsToStatement("liability"), "balance_sheet");
  assert.equal(belongsToStatement("equity"), "balance_sheet");
});

test("income statement takes income and expenses", () => {
  assert.equal(belongsToStatement("income"), "income_statement");
  assert.equal(belongsToStatement("expense"), "income_statement");
});

test("group headers cannot be posted to", () => {
  // Posting to both "1100 Loans Receivable" and its child "1110 Current"
  // would count the same money twice in the subtree total.
  assert.equal(isPostable(account({ is_group: true })), false);
  assert.equal(isPostable(account({ is_group: false })), true);
});

test("an inactive account cannot be posted to", () => {
  assert.equal(isPostable(account({ is_active: false })), false);
});

test("accounts sort into statement order by code", () => {
  const sorted = sortAccounts([
    account({ id: 3, code: "5010" }),
    account({ id: 1, code: "1010" }),
    account({ id: 2, code: "1100" }),
    account({ id: 4, code: "1020" }),
  ]);
  assert.deepEqual(
    sorted.map((a) => a.code),
    ["1010", "1020", "1100", "5010"]
  );
});

test("sorting does not mutate the caller's array", () => {
  const input = [account({ id: 2, code: "2010" }), account({ id: 1, code: "1010" })];
  sortAccounts(input);
  assert.equal(input[0].code, "2010");
});
