import { test } from "node:test";
import assert from "node:assert/strict";
import type { Account } from "@/types";
import {
  AUTO_CATEGORY,
  NO_CASH_KIND,
  type AccountWithCategory,
  NO_PARENT,
  accountBalanceText,
  accountFormFromAccount,
  accountStatusLabel,
  accountTypeItems,
  buildAccountPayload,
  cashFlowCategoryItems,
  cashFlowCategoryLabel,
  cashKindItems,
  emptyAccountForm,
  parentHeadingItems,
} from "./account-form";

const HEADING: Account = {
  id: 10,
  code: "1000",
  name: "Assets",
  type: "asset",
  normal_balance: "debit",
  is_contra: false,
  parent_id: null,
  is_group: true,
  is_active: true,
};

const BANK: AccountWithCategory = {
  id: 12,
  code: "1030",
  name: "Cash in Bank - BDO",
  type: "asset",
  normal_balance: "debit",
  is_contra: false,
  parent_id: 10,
  is_group: false,
  is_active: true,
  cash_kind: "bank",
  cash_flow_category: "cash",
  description: "Main account",
  balance: 1_250_000,
};

const LIABILITIES: Account = { ...HEADING, id: 20, code: "2000", name: "Liabilities", type: "liability" };

test("a new account's payload carries every field, in the server's names", () => {
  const form = {
    ...emptyAccountForm(),
    code: " 1035 ",
    name: " Cash in Bank - BPI ",
    type: "asset" as const,
    parentId: "10",
    cashKind: "bank",
    cashFlowCategory: "cash",
    description: " Payroll ",
  };
  assert.deepEqual(buildAccountPayload(form), {
    code: "1035",
    name: "Cash in Bank - BPI",
    type: "asset",
    parent_id: 10,
    is_contra: false,
    cash_kind: "bank",
    cash_flow_category: "cash",
    description: "Payroll",
  });
});

test("a new account left on automatic lets the server choose its cash flow category", () => {
  const payload = buildAccountPayload(
    { ...emptyAccountForm(), code: "5099", name: "Misc", type: "expense" });
  assert.deepEqual(payload, {
    code: "5099",
    name: "Misc",
    type: "expense",
    parent_id: null,
    is_contra: false,
    cash_kind: null,
    description: null,
  });
  assert.equal(AUTO_CATEGORY in (payload ?? {}), false);
  assert.equal("cash_flow_category" in (payload ?? {}), false);
});

test("an edit keeps a stored category unless one is picked, and never sends null for it", () => {
  const form = { ...accountFormFromAccount(BANK), cashFlowCategory: AUTO_CATEGORY };
  assert.equal("cash_flow_category" in (buildAccountPayload(form) ?? {}), false);
  assert.equal(
    buildAccountPayload(accountFormFromAccount(BANK))?.cash_flow_category,
    "cash",
  );
});

test("a contra account and no parent are sent as such", () => {
  const payload = buildAccountPayload(
    { ...emptyAccountForm(), code: "1200", name: "Allowance", type: "asset", isContra: true });
  assert.equal(payload?.is_contra, true);
  assert.equal(payload?.parent_id, null);
});

test("an account form is refused before sending without a code, name or type", () => {
  const ok = { ...emptyAccountForm(), code: "1035", name: "BPI", type: "asset" as const };
  assert.equal(buildAccountPayload({ ...ok, code: " " }), null);
  assert.equal(buildAccountPayload({ ...ok, name: "" }), null);
  assert.equal(buildAccountPayload({ ...ok, type: "" }), null);
  assert.equal(buildAccountPayload({ ...ok, code: "1".repeat(17) }), null);
  assert.equal(buildAccountPayload({ ...ok, description: "x".repeat(501) }), null);
});

test("the edit form starts from the account", () => {
  assert.deepEqual(accountFormFromAccount(BANK), {
    code: "1030",
    name: "Cash in Bank - BDO",
    type: "asset",
    parentId: "10",
    isContra: false,
    cashKind: "bank",
    cashFlowCategory: "cash",
    description: "Main account",
  });
  assert.deepEqual(accountFormFromAccount({ ...HEADING, parent_id: null }), {
    code: "1000",
    name: "Assets",
    type: "asset",
    parentId: NO_PARENT,
    isContra: false,
    cashKind: NO_CASH_KIND,
    cashFlowCategory: AUTO_CATEGORY,
    description: "",
  });
});

test("every option reads in words", () => {
  assert.deepEqual(
    accountTypeItems.map((i) => i.label),
    ["Asset", "Liability", "Equity", "Income", "Expense"],
  );
  assert.deepEqual(
    cashKindItems.map((i) => i.label),
    ["Not a money account", "Cash", "Bank", "GCash", "Maya", "Wallet"],
  );
  assert.deepEqual(
    cashFlowCategoryItems(true).map((i) => i.label),
    [
      "Automatic, from the type",
      "Operating activities",
      "Investing activities",
      "Financing activities",
      "Cash and cash equivalents",
    ],
  );
  assert.equal(cashFlowCategoryItems(false).some((i) => i.value === AUTO_CATEGORY), false);
  assert.equal(cashFlowCategoryLabel("financing"), "Financing activities");
  assert.equal(cashFlowCategoryLabel("something_new"), "Something New");
});

test("a parent is a heading of the same type, never the account itself", () => {
  const items = parentHeadingItems([HEADING, LIABILITIES, BANK], "asset", HEADING.id);
  assert.deepEqual(items, [{ value: NO_PARENT, label: "No parent (top level)" }]);
  assert.deepEqual(parentHeadingItems([HEADING, LIABILITIES, BANK], "asset", null), [
    { value: NO_PARENT, label: "No parent (top level)" },
    { value: "10", label: "1000 Assets" },
  ]);
});

test("the Balance column shows the server's balance; a heading or a missing one shows a dash", () => {
  assert.equal(accountBalanceText(BANK), "₱12,500.00");
  assert.equal(accountBalanceText({ ...BANK, balance: 0 }), "₱0.00");
  assert.equal(accountBalanceText({ ...BANK, balance: undefined }), "—");
  assert.equal(accountBalanceText({ ...HEADING, balance: 99 }), "—");
});

test("the Status column reads Active or Inactive", () => {
  assert.equal(accountStatusLabel(BANK), "Active");
  assert.equal(accountStatusLabel({ ...BANK, is_active: false }), "Inactive");
});
