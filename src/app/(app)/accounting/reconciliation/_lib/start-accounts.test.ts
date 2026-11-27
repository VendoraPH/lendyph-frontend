import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Account } from "@/types";
import { CHART_UNAVAILABLE, NO_MONEY_ACCOUNT, START_ACCOUNTS_FAILED, startAccounts, startAccountsReason } from "./start-accounts";

const cash = { id: 2, code: "1010", name: "Cash on Hand" };
const bank = { id: 3, code: "1020", name: "Cash in Bank" };

function chartAccount(overrides: Partial<Account>): Account {
  return {
    id: 1,
    code: "1000",
    name: "Assets",
    type: "asset",
    normal_balance: "debit",
    is_contra: false,
    parent_id: null,
    is_group: false,
    is_active: true,
    ...overrides,
  } as Account;
}

const chartMoney = [chartAccount({ id: 2, code: "1010", name: "Cash on Hand", cash_kind: "cash" })];
const readyChart = { loading: false, isTemplate: false, moneyAccounts: chartMoney };

describe("the start form's money accounts", () => {
  test("the reconcilable-accounts list is used as sent: a reconcile-only role needs no chart access", () => {
    const answer = { state: "list" as const, accounts: [cash, bank] };
    const noChart = { loading: false, isTemplate: true, moneyAccounts: [] };
    assert.deepEqual(startAccounts(answer, noChart), { status: "ready", accounts: [cash, bank] });
  });

  test("an older backend without the list (404) falls back to today's chart money accounts", () => {
    assert.deepEqual(startAccounts({ state: "missing" }, readyChart), { status: "ready", accounts: chartMoney });
  });

  test("the fallback waits for the chart, and says so when the chart isn't available", () => {
    assert.deepEqual(startAccounts({ state: "missing" }, { ...readyChart, loading: true }), { status: "loading" });
    assert.deepEqual(startAccounts({ state: "missing" }, { loading: false, isTemplate: true, moneyAccounts: [] }), {
      status: "unavailable",
      reason: CHART_UNAVAILABLE,
    });
  });

  test("while the list loads nothing can be picked yet; a failed list says why", () => {
    assert.deepEqual(startAccounts({ state: "loading" }, readyChart), { status: "loading" });
    assert.deepEqual(startAccounts({ state: "failed" }, readyChart), {
      status: "unavailable",
      reason: START_ACCOUNTS_FAILED,
    });
  });

  test("New reconciliation is disabled with a reason only when no account can be picked", () => {
    assert.equal(startAccountsReason({ status: "ready", accounts: [cash] }), null);
    assert.equal(startAccountsReason({ status: "ready", accounts: [] }), NO_MONEY_ACCOUNT);
    assert.equal(startAccountsReason({ status: "unavailable", reason: CHART_UNAVAILABLE }), CHART_UNAVAILABLE);
    assert.equal(startAccountsReason({ status: "loading" }), null);
  });
});
