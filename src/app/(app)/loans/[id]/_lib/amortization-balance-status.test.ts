/**
 * The Amortization Balance tab's status badge, read from the server's answer.
 *
 * WHAT THIS PROVES: the badge follows the server's `status` and `is_late`
 * only, with late outranking partial and paid outranking both.
 * WHAT IT DOES NOT PROVE: when the server calls a period late; that is
 * `AmortizationSchedule::lateUnpaid()`, covered by the backend's
 * AmortizationBalanceTest.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { balanceStatus } from "./amortization-balance-status";

describe("balanceStatus", () => {
  test("a paid period is paid, whatever its due date", () => {
    assert.equal(balanceStatus({ status: "paid", is_late: false }), "paid");
    assert.equal(balanceStatus({ status: "paid", is_late: true }), "paid");
  });

  test("an unpaid period past its grace is overdue, even when part-paid", () => {
    assert.equal(balanceStatus({ status: "overdue", is_late: true }), "overdue");
    assert.equal(balanceStatus({ status: "partial", is_late: true }), "overdue");
    assert.equal(balanceStatus({ status: "pending", is_late: true }), "overdue");
  });

  test("a part-paid period inside its grace is partial", () => {
    assert.equal(balanceStatus({ status: "partial", is_late: false }), "partial");
  });

  test("an unpaid period the server does not call late is upcoming", () => {
    assert.equal(balanceStatus({ status: "pending", is_late: false }), "upcoming");
    assert.equal(balanceStatus({ status: "overdue", is_late: false }), "upcoming");
  });
});
