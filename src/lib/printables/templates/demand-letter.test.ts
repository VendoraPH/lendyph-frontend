import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, formatValue } from "@/app/(app)/reports/_lib/formatters";
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

/** Fixed "today" so the cure period and days-late figures are deterministic. */
const NOW = new Date(2026, 7, 26);

/** What `ReportService::statementOfAccount()` returns. */
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
    { period_number: 1, due_date: "2026-03-01", principal_due: 16666.67, interest_due: 2000, total_due: 18666.67, principal_paid: 16666.67, interest_paid: 2000, penalty_amount: 0, penalty_paid: 0, status: "paid" },
    // Part-paid and past due — demanded for the remainder only.
    { period_number: 2, due_date: "2026-04-01", principal_due: 16666.67, interest_due: 1666.67, total_due: 18333.34, principal_paid: 6666.67, interest_paid: 0, penalty_amount: 500, penalty_paid: 0, status: "partial" },
    // Unpaid and past due — demanded in full.
    { period_number: 3, due_date: "2026-05-01", principal_due: 16666.66, interest_due: 1333.33, total_due: 17999.99, principal_paid: 0, interest_paid: 0, penalty_amount: 750, penalty_paid: 0, status: "overdue" },
    // Not yet due — never demanded, whatever its status says.
    { period_number: 4, due_date: "2026-09-01", principal_due: 16666.67, interest_due: 1000, total_due: 17666.67, principal_paid: 0, interest_paid: 0, penalty_amount: 0, penalty_paid: 0, status: "pending" },
  ],
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

const PERIOD_2_DUE = 10000 + 1666.67 + 500;
const PERIOD_3_DUE = 16666.66 + 1333.33 + 750;

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

test("demand letter: only installments actually in arrears are demanded", () => {
  const table = tableBlock(buildDemandLetterDoc(PAYLOAD, { now: NOW }), "Installments in Arrears");

  // Period 1 is settled; period 4 is not yet due. Neither may be demanded.
  assert.deepEqual(
    table.rows.map((r) => r.period),
    [2, 3]
  );
  // A part-paid installment is demanded for its remainder, not its face value.
  assert.equal(table.rows[0]?.principal, 10000);
  assert.equal(table.rows[0]?.interest, 1666.67);
  assert.equal(table.rows[0]?.penalty, 500);
  assert.equal(table.rows[0]?.amount_due, 12166.67);
});

test("demand letter: overdue status is derived from the date, not the flag", () => {
  // Period 4 is dated in the future but flagged 'overdue' by a stale nightly
  // job. Demanding it would be demanding money that is not yet owed.
  const doc = buildDemandLetterDoc(
    {
      ...PAYLOAD,
      amortization_schedule: [
        { period_number: 4, due_date: "2026-09-01", principal_due: 16666.67, interest_due: 1000, total_due: 17666.67, principal_paid: 0, interest_paid: 0, penalty_amount: 0, penalty_paid: 0, status: "overdue" },
      ],
    },
    { now: NOW }
  );
  assert.equal(tableBlock(doc, "Installments in Arrears").rows.length, 0);
  assert.equal(chargeAmount(doc, "TOTAL AMOUNT DEMANDED"), formatCurrency(0));
});

/**
 * Yesterday, today and last week, relative to the fixed NOW above.
 *
 * A one-installment schedule per case so each assertion is about one date.
 */
function scheduleDue(dueDate: string) {
  return {
    ...PAYLOAD,
    amortization_schedule: [
      { period_number: 1, due_date: dueDate, principal_due: 10000, interest_due: 0, total_due: 10000, principal_paid: 0, interest_paid: 0, penalty_amount: 0, penalty_paid: 0, status: "pending" },
    ],
  };
}

test("demand letter: days late do not depend on the hour the letter is printed", () => {
  // The bug: `due_date` arrives as "YYYY-MM-DD", which `new Date()` reads as
  // UTC midnight — 08:00 in Manila. Subtracting a local "now" from that made
  // the count an hour-of-the-day question. Printed at 07:00 an installment that
  // fell due YESTERDAY measured 23 hours, floored to 0, and the
  // `days_overdue > 0` filter dropped it from the arrears table AND from the
  // total demanded. The same letter at 09:00 demanded P10,000 more.
  //
  // Under TZ=Asia/Manila these hours are the 07:00 and 09:00 of the review.
  // The assertion is deliberately made across the whole local day: the count
  // must be a property of the calendar, not of the clock.
  const hours = [0, 7, 8, 9, 23];
  const payload = scheduleDue("2026-08-25"); // yesterday

  for (const hour of hours) {
    const doc = buildDemandLetterDoc(payload, {
      now: new Date(2026, 7, 26, hour, 30),
    });
    const rows = tableBlock(doc, "Installments in Arrears").rows;

    assert.equal(rows.length, 1, `dropped the arrears row at ${hour}:30`);
    assert.equal(rows[0]?.days_overdue, 1, `wrong days late at ${hour}:30`);
    assert.equal(
      chargeAmount(doc, "TOTAL AMOUNT DEMANDED"),
      formatCurrency(10000),
      `wrong total demanded at ${hour}:30`
    );
    assert.equal(fieldValue(doc, "Longest overdue installment"), "1 day(s)");
  }
});

test("demand letter: an installment due today is not yet late, at any hour", () => {
  for (const hour of [0, 7, 9, 23]) {
    const doc = buildDemandLetterDoc(scheduleDue("2026-08-26"), {
      now: new Date(2026, 7, 26, hour, 30),
    });
    assert.equal(tableBlock(doc, "Installments in Arrears").rows.length, 0);
    assert.equal(chargeAmount(doc, "TOTAL AMOUNT DEMANDED"), formatCurrency(0));
  }
});

test("demand letter: the count is whole calendar days, not elapsed hours", () => {
  // 2026-08-20 is six calendar days before 2026-08-26. It was reported as five
  // before 08:00 Manila and six after.
  for (const hour of [7, 9]) {
    const doc = buildDemandLetterDoc(scheduleDue("2026-08-20"), {
      now: new Date(2026, 7, 26, hour, 0),
    });
    assert.equal(
      tableBlock(doc, "Installments in Arrears").rows[0]?.days_overdue,
      6
    );
  }
});

test("demand letter: the total demanded is the sum of the rows above it", () => {
  const doc = buildDemandLetterDoc(PAYLOAD, { now: NOW });
  const table = tableBlock(doc, "Installments in Arrears");
  const expected = formatCurrency(PERIOD_2_DUE + PERIOD_3_DUE);

  assert.equal(table.totals?.amount_due, expected);
  assert.equal(chargeAmount(doc, "TOTAL AMOUNT DEMANDED"), expected);
  // Column totals reconcile component by component too.
  assert.equal(table.totals?.principal, formatCurrency(10000 + 16666.66));
  assert.equal(table.totals?.interest, formatCurrency(1666.67 + 1333.33));
  assert.equal(table.totals?.penalty, formatCurrency(500 + 750));

  // The demand is a subset of the balance, never larger than it.
  assert.equal(
    fieldValue(doc, "Total outstanding balance"),
    formatCurrency(81916.66)
  );
  assert.ok(PERIOD_2_DUE + PERIOD_3_DUE < 81916.66);
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

test("demand letter: days late are counted per row and the worst is highlighted", () => {
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
    { ...PAYLOAD, amortization_schedule: [] },
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
