import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CASH_ACCOUNTS_PER_PAGE,
  accountHistoryHref,
  cashKindTotals,
  cashListIsIncomplete,
} from "./cash-bank";

test("the page asks for the server's largest page", () => {
  assert.equal(CASH_ACCOUNTS_PER_PAGE, 100);
});

test("each account's history opens the general ledger on that account", () => {
  assert.equal(accountHistoryHref(12), "/accounting/general-ledger?account_id=12");
});

test("the total per kind is the server's, one line per kind, in words", () => {
  assert.deepEqual(
    cashKindTotals({ cash: 10_000, bank: 250_000, gcash: 0, maya: 0, wallet: -500 }),
    [
      { kind: "cash", label: "Cash", amount: 10_000 },
      { kind: "bank", label: "Bank", amount: 250_000 },
      { kind: "gcash", label: "GCash", amount: 0 },
      { kind: "maya", label: "Maya", amount: 0 },
      { kind: "wallet", label: "Wallet", amount: -500 },
    ],
  );
});

test("a kind the server left out reads as missing, never as zero", () => {
  const lines = cashKindTotals({ cash: 10_000 } as never);
  assert.equal(lines.find((l) => l.kind === "bank")?.amount, null);
  assert.deepEqual(cashKindTotals(undefined), []);
});

test("the list is incomplete only when the server holds more accounts than it sent", () => {
  assert.equal(cashListIsIncomplete({ total: 120 }, 100), true);
  assert.equal(cashListIsIncomplete({ total: 100 }, 100), false);
  assert.equal(cashListIsIncomplete({}, 3), false);
  assert.equal(cashListIsIncomplete(undefined, 3), false);
});
