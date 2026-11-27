// Dates are shown in the app's zone. Pin it for the same reason format.test.ts
// does — see the note there for how and why.
process.env.TZ = "Asia/Manila";

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BINHS_MAX_TERM_MONTHS,
  binhsRequest,
  displayBinhsScenario,
  inputFromPrefill,
  paidFlagsFor,
  type BinhsInput,
  type BinhsScenario,
} from "./binhs";

const input = (over: Partial<BinhsInput> = {}): BinhsInput => ({
  principal: "10000",
  annualRate: "24",
  termMonths: "3",
  scbuPerPeriod: "100",
  startDate: "2026-08-07",
  ...over,
});

/**
 * A stubbed `POST /loans/amortization-calculator/binhs` scenario, in the shape
 * `BinhsCalculator::withTotals()` sends: every figure a 2-decimal string.
 */
const SCENARIO: BinhsScenario = {
  rows: [
    {
      period: 1,
      due_date: "2026-08-31",
      principal: "4429517.83",
      interest: "0.00",
      penalty: "0.00",
      scbu: "100.00",
      total_payment: "4429617.83",
      running_balance: "4429517.82",
    },
    {
      period: 2,
      due_date: "2026-09-30",
      principal: "4429517.82",
      interest: "0.00",
      penalty: "885903.56",
      scbu: "100.00",
      total_payment: "5315521.38",
      running_balance: "0.00",
    },
  ],
  totals: {
    principal: "8859035.65",
    interest: "0.00",
    penalty: "885903.56",
    scbu: "200.00",
    total_payment: "9745139.21",
  },
};

test("the schedule reads the server's rows and totals as sent, in pesos and dates", () => {
  const shown = displayBinhsScenario(SCENARIO);

  assert.deepEqual(shown.rows[0], {
    period: 1,
    dueDate: "Aug 31, 2026",
    principal: "₱4,429,517.83",
    interest: "₱0.00",
    penalty: "₱0.00",
    scbu: "₱100.00",
    totalPayment: "₱4,429,617.83",
    runningBalance: "₱4,429,517.82",
  });
  assert.equal(shown.rows[1].penalty, "₱885,903.56");
  assert.equal(shown.rows[1].runningBalance, "₱0.00");

  // The totals are the server's, never the rows added up here.
  assert.deepEqual(shown.totals, {
    principal: "₱8,859,035.65",
    interest: "₱0.00",
    penalty: "₱885,903.56",
    scbu: "₱200.00",
    totalPayment: "₱9,745,139.21",
  });
});

test("a total the server reports is shown even when the rows would add up differently", () => {
  const shown = displayBinhsScenario({
    rows: SCENARIO.rows,
    totals: { ...SCENARIO.totals, principal: "8859035.66" },
  });
  assert.equal(shown.totals?.principal, "₱8,859,035.66");
});

test("no scenario reads as no rows and no totals", () => {
  assert.deepEqual(displayBinhsScenario(null), { rows: [], totals: null });
});

test("the request sends the inputs as typed, trimmed, with the custom paid flags", () => {
  assert.deepEqual(binhsRequest(input({ principal: " 10000.50 " }), [true, false, true]), {
    principal: "10000.50",
    annual_rate: "24",
    term_months: 3,
    start_date: "2026-08-07",
    scbu_per_period: "100",
    paid_flags: [true, false, true],
  });
});

test("a blank build-up is sent as none, and the server defaults it to ₱0.00", () => {
  const body = binhsRequest(input({ scbuPerPeriod: "  " }), []);
  assert.ok(body);
  assert.equal("scbu_per_period" in body, false);
});

test("the request is held back until every required input is there", () => {
  assert.equal(binhsRequest(input({ principal: "" }), []), null);
  assert.equal(binhsRequest(input({ annualRate: " " }), []), null);
  assert.equal(binhsRequest(input({ termMonths: "" }), []), null);
  assert.equal(binhsRequest(input({ termMonths: "2.5" }), []), null);
  assert.equal(binhsRequest(input({ termMonths: "0" }), []), null);
  assert.equal(binhsRequest(input({ termMonths: String(BINHS_MAX_TERM_MONTHS + 1) }), []), null);
  assert.equal(binhsRequest(input({ startDate: "" }), []), null);
  assert.equal(binhsRequest(input({ startDate: "not-a-date" }), []), null);
});

test("a start date carrying a time component sends its calendar day", () => {
  // loan.start_date can arrive as "YYYY-MM-DD HH:mm:ss"; the server takes
  // YYYY-MM-DD only.
  assert.equal(binhsRequest(input({ startDate: "2026-08-07 00:00:00" }), [])?.start_date, "2026-08-07");
});

test("paid flags cover the term, from period 1, unpaid unless ticked", () => {
  assert.deepEqual(paidFlagsFor(4, { 0: true, 2: true }), [true, false, true, false]);
  assert.deepEqual(paidFlagsFor(2, { 0: true, 3: true }), [true, false]);
  assert.deepEqual(paidFlagsFor(0, { 0: true }), []);
});

test("the prefill takes the server's annual rate, never converting one here", () => {
  const current = input();
  assert.deepEqual(
    inputFromPrefill(
      { loan_id: 9, principal: "50000.00", annual_rate: "36", term_months: 12, start_date: "2026-09-15" },
      current,
    ),
    { ...current, principal: "50000.00", annualRate: "36", termMonths: "12", startDate: "2026-09-15" },
  );
});

test("a prefill rate or term the server can't state is left blank for staff to enter", () => {
  const current = input();
  assert.deepEqual(
    inputFromPrefill(
      { loan_id: 9, principal: "50000.00", annual_rate: null, term_months: null, start_date: null },
      current,
    ),
    { ...current, principal: "50000.00", annualRate: "", termMonths: "" },
  );
});
