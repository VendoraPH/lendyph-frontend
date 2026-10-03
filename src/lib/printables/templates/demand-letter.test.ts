// The days-late count is the server's now (`days_overdue`, as of today in
// Manila), so nothing here counts days. The pin stays for the dates this file
// does build — the letter's date and the settle-by date — so they are Manila
// calendar days on every runner, the CI runner (which sets no TZ) included.
//
// How: assigning `process.env.TZ` makes Node re-read the zone (it notifies V8,
// which drops its cached offset), and `node:test` runs each test file in its
// own process, so this cannot leak into a sibling suite. The first test asserts
// the pin actually took. Same pattern as `src/lib/format.test.ts`.
process.env.TZ = "Asia/Manila";

import { test } from "node:test";
import assert from "node:assert/strict";
import { DASH, formatCurrency, formatValue } from "@/lib/report-format";
import { CURE_PERIOD_DAYS, buildDemandLetterDoc } from "./demand-letter";
import { BLANK_LINE } from "./shared";
import {
  assertPrintableShape,
  chargeAmount,
  fieldValue,
  isBlankField,
  prose,
  signatureLabels,
  tableBlock,
  titleBlock,
} from "./doc-assertions";

/** Fixed "today" so the letter date and the cure period are deterministic. */
const NOW = new Date(2026, 7, 26);

test("the suite is pinned to Manila (UTC+8), not the machine's zone", () => {
  // `NOW` is built with the local-time `Date` constructor, so its UTC offset is
  // the machine's. Asserting on it checks the pin against the very value the
  // rest of the file dates from, rather than against an unrelated instant.
  assert.equal(
    NOW.getTimezoneOffset(),
    -480,
    "TZ pin did not take effect — the date assertions below would depend on the machine"
  );
});

/**
 * What `ReportService::statementOfAccount()` returns on NOW: each schedule row
 * carries the server's arrears (`remaining`, `amount_due`, `days_overdue`,
 * `is_overdue`), and the letter's totals sit beside the schedule.
 */
const PAYLOAD = {
  loan: {
    loan_account_number: "LN-2026-0042",
    application_number: "APP-2026-0042",
    principal_amount: 100000,
    interest_rate: 2,
    interest_method: "diminishing",
    term: 6,
    frequency: "monthly",
    start_date: "2026-02-01",
    maturity_date: "2026-08-01",
    status: "past_due",
  },
  borrower: {
    borrower_code: "MBR-0001",
    full_name: "Juana Dela Cruz",
    address: "12 Mabini St., Poblacion, Cebu City",
  },
  transactions: [
    {
      date: "2026-03-01",
      receipt_number: "OR-20260301-0001",
      amount_paid: 18666.67,
      principal_applied: 16666.67,
      interest_applied: 2000,
      penalty_applied: 0,
      running_balance: 83333.33,
    },
  ],
  amortization_schedule: [
    // Settled — not demanded.
    { period_number: 1, due_date: "2026-03-01", principal_due: 16666.67, interest_due: 2000, total_due: 18666.67, principal_paid: 16666.67, interest_paid: 2000, penalty_amount: 0, penalty_paid: 0, status: "paid",
      remaining: { principal: 0, interest: 0, penalty: 0 }, amount_due: 0, days_overdue: 178, is_overdue: false },
    // Part-paid and past due — demanded for the remainder only.
    { period_number: 2, due_date: "2026-04-01", principal_due: 16666.67, interest_due: 1666.67, total_due: 18333.34, principal_paid: 6666.67, interest_paid: 0, penalty_amount: 500, penalty_paid: 0, status: "partial",
      remaining: { principal: 10000, interest: 1666.67, penalty: 500 }, amount_due: 12166.67, days_overdue: 147, is_overdue: true },
    // Unpaid and past due — demanded in full.
    { period_number: 3, due_date: "2026-05-01", principal_due: 16666.66, interest_due: 1333.33, total_due: 17999.99, principal_paid: 0, interest_paid: 0, penalty_amount: 750, penalty_paid: 0, status: "overdue",
      remaining: { principal: 16666.66, interest: 1333.33, penalty: 750 }, amount_due: 18749.99, days_overdue: 117, is_overdue: true },
    // Not yet due — never demanded.
    { period_number: 4, due_date: "2026-09-01", principal_due: 16666.67, interest_due: 1000, total_due: 17666.67, principal_paid: 0, interest_paid: 0, penalty_amount: 0, penalty_paid: 0, status: "pending",
      remaining: { principal: 16666.67, interest: 1000, penalty: 0 }, amount_due: 17666.67, days_overdue: 0, is_overdue: false },
  ],
  total_demanded: 30916.66,
  demand_totals: { principal: 26666.66, interest: 3000, penalty: 1250, amount_due: 30916.66 },
  summary: {
    total_paid: 18666.67,
    opening_balance: 100000,
    outstanding_principal: 76666.66,
    outstanding_interest: 4000,
    outstanding_penalty: 1250,
    principal_balance: 76666.66,
    outstanding_balance: 81916.66,
  },
  generated_at: "2026-08-26 09:15:00",
};

test("demand letter: addresses the member and states the as-of date", () => {
  const doc = buildDemandLetterDoc(PAYLOAD, { now: NOW });
  assertPrintableShape(doc, "demand_letter");

  assert.equal(titleBlock(doc).text, "Notice of Past Due Account");
  assert.equal(titleBlock(doc).subtitle, "Demand for Payment");
  assert.equal(fieldValue(doc, "Member"), "Juana Dela Cruz");
  assert.equal(fieldValue(doc, "Member No."), "MBR-0001");
  assert.equal(fieldValue(doc, "Loan Account No."), "LN-2026-0042");
  assert.equal(fieldValue(doc, "Address"), "12 Mabini St., Poblacion, Cebu City");
  assert.equal(fieldValue(doc, "Date"), formatValue(NOW, "date"));
  assert.match(prose(doc), /Dear Juana Dela Cruz,/);
});

test("demand letter: only the installments the server marks in arrears are demanded", () => {
  const table = tableBlock(buildDemandLetterDoc(PAYLOAD, { now: NOW }), "Installments in Arrears");

  // Period 1 is settled; period 4 is not yet due. Neither may be demanded.
  assert.deepEqual(
    table.rows.map((r) => r.period),
    [2, 3]
  );
  // A part-paid installment is demanded for the server's remainder.
  assert.equal(table.rows[0]?.principal, 10000);
  assert.equal(table.rows[0]?.interest, 1666.67);
  assert.equal(table.rows[0]?.penalty, 500);
  assert.equal(table.rows[0]?.amount_due, 12166.67);
  assert.equal(table.rows[0]?.days_overdue, 147);
});

test("demand letter: a row's figures are the server's, a dash when it sent none", () => {
  // `remaining` deliberately unlike due − paid: whatever the server says is
  // still owed is what the letter demands.
  const doc = buildDemandLetterDoc(
    {
      ...PAYLOAD,
      amortization_schedule: [
        { period_number: 2, due_date: "2026-04-01", principal_due: 16666.67, principal_paid: 0, is_overdue: true,
          remaining: { principal: 9999.99 }, days_overdue: 147 },
      ],
    },
    { now: NOW }
  );
  const [row] = tableBlock(doc, "Installments in Arrears").rows;
  assert.equal(row?.principal, 9999.99);
  assert.equal(row?.interest, null);
  assert.equal(row?.penalty, null);
  assert.equal(row?.amount_due, null);
});

test("demand letter: arrears are the server's flag, not the row's status or date", () => {
  // Period 4 is flagged 'overdue' by a stale nightly job, and period 1 is long
  // past due but settled. The server's `is_overdue` says neither is in arrears.
  const doc = buildDemandLetterDoc(
    {
      ...PAYLOAD,
      amortization_schedule: [PAYLOAD.amortization_schedule[0], { ...PAYLOAD.amortization_schedule[3], status: "overdue" }],
      total_demanded: 0,
      demand_totals: { principal: 0, interest: 0, penalty: 0, amount_due: 0 },
    },
    { now: NOW }
  );
  assert.equal(tableBlock(doc, "Installments in Arrears").rows.length, 0);
  assert.equal(chargeAmount(doc, "TOTAL AMOUNT DEMANDED"), formatCurrency(0));
});

test("demand letter: days late are the server's, whatever the hour the letter is printed", () => {
  // The letter used to count days itself and, before 08:00 Manila, dropped an
  // installment that fell due yesterday. The count is the server's now.
  const payload = {
    ...PAYLOAD,
    amortization_schedule: [
      { period_number: 1, due_date: "2026-08-25", principal_due: 10000, principal_paid: 0, status: "pending",
        remaining: { principal: 10000, interest: 0, penalty: 0 }, amount_due: 10000, days_overdue: 1, is_overdue: true },
    ],
    total_demanded: 10000,
    demand_totals: { principal: 10000, interest: 0, penalty: 0, amount_due: 10000 },
  };

  for (const hour of [0, 7, 8, 9, 23]) {
    const doc = buildDemandLetterDoc(payload, { now: new Date(2026, 7, 26, hour, 30) });
    const rows = tableBlock(doc, "Installments in Arrears").rows;

    assert.equal(rows.length, 1, `dropped the arrears row at ${hour}:30`);
    assert.equal(rows[0]?.days_overdue, 1, `wrong days late at ${hour}:30`);
    assert.equal(chargeAmount(doc, "TOTAL AMOUNT DEMANDED"), formatCurrency(10000));
    assert.equal(fieldValue(doc, "Longest overdue installment"), "1 day(s)");
  }
});

test("demand letter: the total demanded and the column totals are the server's", () => {
  const doc = buildDemandLetterDoc(PAYLOAD, { now: NOW });
  const table = tableBlock(doc, "Installments in Arrears");

  assert.equal(table.totals?.amount_due, formatCurrency(30916.66));
  assert.equal(chargeAmount(doc, "TOTAL AMOUNT DEMANDED"), formatCurrency(30916.66));
  assert.equal(table.totals?.principal, formatCurrency(26666.66));
  assert.equal(table.totals?.interest, formatCurrency(3000));
  assert.equal(table.totals?.penalty, formatCurrency(1250));
  assert.equal(fieldValue(doc, "Total outstanding balance"), formatCurrency(81916.66));

  // A server total unlike the rows added up is printed as sent.
  const sent = buildDemandLetterDoc({ ...PAYLOAD, total_demanded: 30916.67 }, { now: NOW });
  assert.equal(chargeAmount(sent, "TOTAL AMOUNT DEMANDED"), formatCurrency(30916.67));
});

test("demand letter: totals the server did not send are dashes, never sums of the rows", () => {
  const { total_demanded: _total, demand_totals: _columns, ...rest } = PAYLOAD;
  void _total;
  void _columns;
  const doc = buildDemandLetterDoc(rest, { now: NOW });
  const table = tableBlock(doc, "Installments in Arrears");

  assert.equal(table.rows.length, 2);
  assert.equal(chargeAmount(doc, "TOTAL AMOUNT DEMANDED"), DASH);
  for (const key of ["principal", "interest", "penalty", "amount_due"]) {
    assert.equal(table.totals?.[key], DASH, key);
  }
});

test("demand letter: the cure period is stated as a date and a count of days", () => {
  const doc = buildDemandLetterDoc(PAYLOAD, { now: NOW });
  const settleBy = new Date(2026, 7, 26 + CURE_PERIOD_DAYS);

  assert.equal(CURE_PERIOD_DAYS, 15);
  assert.equal(
    fieldValue(doc, "Settle on or before"),
    formatValue(settleBy, "date")
  );
  assert.match(
    prose(doc),
    new RegExp(`being ${CURE_PERIOD_DAYS} days from the date of this notice`)
  );
});

test("demand letter: days late are shown per row and the worst is highlighted", () => {
  const doc = buildDemandLetterDoc(PAYLOAD, { now: NOW });
  const rows = tableBlock(doc, "Installments in Arrears").rows;
  const [first, second] = rows as { days_overdue: number }[];

  assert.ok(first!.days_overdue > second!.days_overdue);
  assert.equal(
    fieldValue(doc, "Longest overdue installment"),
    `${first!.days_overdue} day(s)`
  );
});

test("demand letter: consequences track the note the member already signed", () => {
  const text = prose(buildDemandLetterDoc(PAYLOAD, { now: NOW }));

  assert.match(text, /shall become due and demandable in full without need of further notice/);
  assert.match(text, /in accordance with the acceleration clause of the Promissory Note you executed/);
  assert.match(text, /attorney's fees and costs of collection provided for in that Note/);
  assert.match(text, /Your co-maker, being solidarily liable, may likewise be proceeded against directly/);
  // And a way out, so the letter is a demand rather than only a threat.
  assert.match(text, /if you wish to discuss a restructuring of your account/);
});

test("demand letter: it is signed by an authorised officer", () => {
  const doc = buildDemandLetterDoc(PAYLOAD, { now: NOW });
  assert.deepEqual(signatureLabels(doc), ["Authorized Signatory", "Noted by"]);
});

test("demand letter: an unreadable account demands nothing", () => {
  // Failing soft printed a notice with no member, no account number and
  // "TOTAL AMOUNT DEMANDED P0.00" over an authorised signatory's line — a
  // demand for nothing, served on nobody, indistinguishable from a real one.
  const doc = buildDemandLetterDoc(null, { now: NOW });
  assertPrintableShape(doc, "demand_letter");

  assert.equal(doc.incomplete, true);
  assert.equal(chargeAmount(doc, "TOTAL AMOUNT DEMANDED"), BLANK_LINE);
  assert.notEqual(
    chargeAmount(doc, "TOTAL AMOUNT DEMANDED"),
    formatCurrency(0)
  );

  // The arrears assertion is replaced, not merely emptied.
  const text = prose(doc);
  assert.doesNotMatch(text, /Our records show that your loan account/);
  assert.match(text, /\*\*\* D O &nbsp;N O T &nbsp;S E R V E \*\*\*/);
  assert.match(text, /Nothing is demanded by this document/);
  assert.equal(titleBlock(doc).subtitle, "DATA UNAVAILABLE — DO NOT SERVE");
  assert.match(doc.footerNote ?? "", /DO NOT SERVE/);

  assert.ok(isBlankField(doc, "Member"));
  assert.ok(isBlankField(doc, "Loan Account No."));
  // The date is always known — it is the day the notice is issued.
  assert.equal(fieldValue(doc, "Date"), formatValue(NOW, "date"));

  const table = tableBlock(doc, "Installments in Arrears");
  assert.equal(table.rows.length, 0);
  assert.equal(table.totals, undefined);
  assert.match(table.emptyText ?? "", /No installment is demanded by this notice/);
  assert.match(text, /Dear Member,/);
});

test("demand letter: an account with nothing overdue is a real notice, not a blank", () => {
  // The account loaded and is current. That is a statement the cooperative can
  // make, and it demands a genuine zero — the distinction from an unreachable
  // endpoint is the whole point of the flag.
  const doc = buildDemandLetterDoc(
    {
      ...PAYLOAD,
      amortization_schedule: [],
      total_demanded: 0,
      demand_totals: { principal: 0, interest: 0, penalty: 0, amount_due: 0 },
    },
    { now: NOW }
  );

  assert.equal(doc.incomplete, undefined);
  assert.equal(titleBlock(doc).subtitle, "Demand for Payment");
  assert.equal(chargeAmount(doc, "TOTAL AMOUNT DEMANDED"), formatCurrency(0));
  assert.match(prose(doc), /Our records show that your loan account/);
  assert.match(
    tableBlock(doc, "Installments in Arrears").emptyText ?? "",
    /No installment on this account is past due as of the date of this notice\./
  );
});
