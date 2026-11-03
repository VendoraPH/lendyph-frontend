import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { transactionRowActions } from "./account-status";
import {
  emptyMovementForm,
  emptyTransferForm,
  movementPayload,
  transferPayload,
} from "./transaction-form";

const TODAY = "2026-11-03";

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

const account = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  status: "active" as const,
  available_balance: "5000.00",
  product: { ...product },
  ...over,
});

describe("movementPayload", () => {
  test("names every missing field at once", () => {
    const check = movementPayload("deposit", emptyMovementForm(TODAY), null, TODAY);
    assert.deepEqual(check, { ok: false, fields: ["Account", "Deposit amount"], message: undefined });
  });

  test("refuses a future date", () => {
    const form = { ...emptyMovementForm(TODAY, 1), amount: "100", transaction_date: "2026-11-04" };
    const check = movementPayload("deposit", form, account(1), TODAY);
    assert.equal(check.ok, false);
    assert.match(!check.ok ? (check.message ?? "") : "", /future/);
  });

  test("builds a deposit payload, trimming optional text", () => {
    const form = { ...emptyMovementForm(TODAY, 1), amount: "2500.50", reference_number: " OR-1 ", remarks: "  " };
    assert.deepEqual(movementPayload("deposit", form, account(1), TODAY), {
      ok: true,
      payload: {
        account_id: 1,
        amount: 2500.5,
        transaction_date: TODAY,
        payment_method: "cash",
        reference_number: "OR-1",
      },
    });
  });

  test("a withdrawal can't break the maintaining balance", () => {
    const form = { ...emptyMovementForm(TODAY, 1), amount: "4600" };
    const check = movementPayload("withdrawal", form, account(1), TODAY);
    assert.equal(check.ok, false);
    assert.match(!check.ok ? (check.message ?? "") : "", /maintaining balance/);
  });

  test("a frozen account takes no deposit", () => {
    const form = { ...emptyMovementForm(TODAY, 1), amount: "100" };
    const check = movementPayload("deposit", form, account(1, { status: "frozen" }), TODAY);
    assert.match(!check.ok ? (check.message ?? "") : "", /frozen/);
  });
});

describe("transferPayload", () => {
  test("names both missing accounts", () => {
    const check = transferPayload(emptyTransferForm(TODAY), null, null, TODAY);
    assert.deepEqual(!check.ok && check.fields, ["Source account", "Destination account", "Transfer amount"]);
  });

  test("refuses the same account on both sides", () => {
    const form = { ...emptyTransferForm(TODAY, 1), to_account_id: 1, amount: "100" };
    const check = transferPayload(form, account(1), account(1), TODAY);
    assert.match(!check.ok ? (check.message ?? "") : "", /two different accounts/);
  });

  test("builds the payload when both sides allow it", () => {
    const form = { ...emptyTransferForm(TODAY, 1), to_account_id: 2, amount: "1000" };
    assert.deepEqual(transferPayload(form, account(1), account(2), TODAY), {
      ok: true,
      payload: { from_account_id: 1, to_account_id: 2, amount: 1000, transaction_date: TODAY },
    });
  });

  test("a closed destination is refused and named", () => {
    const form = { ...emptyTransferForm(TODAY, 1), to_account_id: 2, amount: "1000" };
    const check = transferPayload(form, account(1), account(2, { status: "closed" }), TODAY);
    assert.match(!check.ok ? (check.message ?? "") : "", /^Destination account/);
  });
});

describe("transactionRowActions", () => {
  const posted = { status: "posted" as const, type: "deposit" as const };
  const all = { canReverse: true, canApprove: true, userId: 7 };

  test("reverse needs the permission and a reversible transaction", () => {
    assert.equal(transactionRowActions(posted, all).reverse, true);
    assert.equal(transactionRowActions(posted, { ...all, canReverse: false }).reverse, false);
    assert.equal(transactionRowActions({ ...posted, type: "interest" }, all).reverse, false);
    assert.equal(transactionRowActions({ ...posted, type: "closing_withdrawal" }, all).reverse, false);
  });

  test("a pending reversal is reviewable, but not by the one who asked", () => {
    const tx = { ...posted, pending_reversal: { id: 40, requested_by: { id: 7 } } };
    assert.deepEqual(transactionRowActions(tx, all), { reverse: false, review: { reversalId: 40, ownRequest: true } });
    assert.deepEqual(transactionRowActions(tx, { ...all, userId: 8 }).review, { reversalId: 40, ownRequest: false });
    assert.equal(transactionRowActions(tx, { ...all, canApprove: false }).review, null);
  });
});
