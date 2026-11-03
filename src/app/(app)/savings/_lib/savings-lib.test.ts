import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  canDeposit,
  canWithdraw,
  projectedBalance,
  validateOpening,
  validateTransfer,
  validateWithdrawal,
  withdrawableCentavos,
} from "./savings-rules";
import { dailyInterest, daysInMonth, isLeapYear, periodInterest } from "./interest-preview";
import { allowedStatusActions, isReversible } from "./account-status";

const product = {
  id: 1,
  code: "RS",
  name: "Regular Savings",
  min_maintaining_balance: "500.00",
  min_initial_deposit: "1000.00",
  allow_deposits: true,
  allow_withdrawals: true,
  max_withdrawal_amount: null as string | null,
};

const account = (over: Record<string, unknown> = {}) => ({
  id: 1,
  status: "active" as const,
  available_balance: "5000.00",
  product: { ...product },
  ...over,
});

describe("savings-rules", () => {
  test("closed and frozen accounts take no deposits; dormant ones do", () => {
    assert.equal(canDeposit(account({ status: "closed" })).ok, false);
    assert.equal(canDeposit(account({ status: "frozen" })).ok, false);
    assert.equal(canDeposit(account({ status: "dormant" })).ok, true);
  });

  test("dormant accounts can't withdraw", () => {
    assert.equal(canWithdraw(account({ status: "dormant" })).ok, false);
  });

  test("a product that disallows deposits or withdrawals is respected", () => {
    const p = { ...product, allow_deposits: false, allow_withdrawals: false };
    assert.equal(canDeposit(account({ product: p })).ok, false);
    assert.equal(canWithdraw(account({ product: p })).ok, false);
  });

  test("withdrawals keep the maintaining balance", () => {
    assert.equal(withdrawableCentavos(account()), 450000);
    assert.equal(validateWithdrawal(account(), 4500).ok, true);
    const tooMuch = validateWithdrawal(account(), 4500.01);
    assert.equal(tooMuch.ok, false);
    assert.match((tooMuch as { message: string }).message, /maintaining balance/);
  });

  test("insufficient funds is named as such", () => {
    const r = validateWithdrawal(account(), 6000);
    assert.match((r as { message: string }).message, /Insufficient funds/);
  });

  test("the per-withdrawal cap applies", () => {
    const capped = account({ product: { ...product, max_withdrawal_amount: "1000.00" } });
    assert.equal(withdrawableCentavos(capped), 100000);
    assert.match((validateWithdrawal(capped, 1500) as { message: string }).message, /at most/);
  });

  test("never negative headroom", () => {
    assert.equal(withdrawableCentavos(account({ available_balance: "100.00" })), 0);
  });

  test("transfers refuse the same account and check both sides", () => {
    assert.equal(validateTransfer(account(), account(), 10).ok, false);
    const r = validateTransfer(account(), account({ id: 2, status: "closed" }), 10);
    assert.match((r as { message: string }).message, /^Destination account/);
    assert.equal(validateTransfer(account(), account({ id: 2 }), 10).ok, true);
  });

  test("opening needs an active product and the minimum initial deposit", () => {
    assert.equal(validateOpening({ status: "inactive", min_initial_deposit: "0" }, 100).ok, false);
    assert.equal(validateOpening({ status: "active", min_initial_deposit: "1000.00" }, 999.99).ok, false);
    assert.equal(validateOpening({ status: "active", min_initial_deposit: "1000.00" }, 1000).ok, true);
  });

  test("projected balance is exact to the centavo", () => {
    assert.equal(projectedBalance("0.10", 0.2, "in"), 0.3);
    assert.equal(projectedBalance("5000.00", 4500.01, "out"), 499.99);
  });
});

describe("interest-preview", () => {
  test("100,000 at 2% on a 365 basis is ₱5.479… a day", () => {
    assert.ok(Math.abs(dailyInterest(100_000, 2, "365", 2026) - 5.47945) < 1e-5);
  });

  test("actual basis uses 366 days in a leap year only", () => {
    assert.equal(isLeapYear(2028), true);
    assert.equal(isLeapYear(2100), false);
    assert.equal(isLeapYear(2000), true);
    assert.ok(Math.abs(dailyInterest(100_000, 2, "actual", 2028) - 5.46448) < 1e-5);
    assert.equal(dailyInterest(100_000, 2, "actual", 2026), dailyInterest(100_000, 2, "365", 2026));
    assert.equal(dailyInterest(100_000, 2, "365", 2028), dailyInterest(100_000, 2, "365", 2026));
  });

  test("month end: a 30-day November at 100,000 earns 164.38", () => {
    assert.equal(daysInMonth(2026, 11), 30);
    assert.equal(daysInMonth(2028, 2), 29);
    const days = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-11-${String(i + 1).padStart(2, "0")}`,
      balance: 100_000,
    }));
    const r = periodInterest(days, 2, "365");
    assert.equal(r.interest, 164.38);
    assert.equal(r.eligibleDays, 30);
    assert.equal(r.averageDailyBalance, 100_000);
  });

  test("days below the minimum balance earn nothing", () => {
    const days = [
      { date: "2026-11-01", balance: 400 },
      { date: "2026-11-02", balance: 100_000 },
    ];
    const r = periodInterest(days, 2, "365", 500);
    assert.equal(r.eligibleDays, 1);
    assert.equal(r.interest, 5.48);
    assert.equal(r.averageDailyBalance, 50_200);
  });

  test("zero rate or empty period earns nothing", () => {
    assert.equal(periodInterest([], 2, "365").interest, 0);
    assert.equal(dailyInterest(1000, 0, "365", 2026), 0);
  });
});

describe("account-status", () => {
  test("transitions offered per status", () => {
    assert.deepEqual(allowedStatusActions("active"), ["freeze", "close"]);
    assert.deepEqual(allowedStatusActions("frozen"), ["unfreeze"]);
    assert.deepEqual(allowedStatusActions("closed"), []);
    assert.ok(allowedStatusActions("dormant").includes("reactivate"));
  });

  test("only posted, non-reversal transactions without a pending request reverse", () => {
    assert.equal(isReversible({ status: "posted", type: "deposit" }), true);
    assert.equal(isReversible({ status: "reversed", type: "deposit" }), false);
    assert.equal(isReversible({ status: "posted", type: "reversal" }), false);
    assert.equal(
      isReversible({ status: "posted", type: "deposit", pending_reversal: { id: 1 } }),
      false,
    );
  });
});
