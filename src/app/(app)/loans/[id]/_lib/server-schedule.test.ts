import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NO_SCHEDULE_TOTALS,
  readPreviewResponse,
  readScheduleRows,
  readScheduleTotals,
  toDisplaySchedule,
} from "./server-schedule";

/** A persisted row as `AmortizationScheduleResource` serialises it. */
const persisted = (
  period: number,
  row: {
    principal_due: number;
    interest_due: number;
    remaining_balance: number;
    principal_paid?: number;
    interest_paid?: number;
    status: "paid" | "partial" | "overdue" | "pending";
    due_date: string;
    share_capital_build_up?: number;
    total_payment?: number;
  },
) => ({
  id: 500 + period,
  loan_id: 42,
  period_number: period,
  beginning_balance: 0,
  penalty_amount: 0,
  total_due: row.principal_due + row.interest_due,
  penalty_paid: 0,
  principal_paid: 0,
  interest_paid: 0,
  share_capital_build_up: 50,
  total_payment: row.principal_due + row.interest_due + 50,
  ...row,
});

/** A server schedule whose `remaining_balance` came back 0 on every row. */
const ZERO_BALANCE_ROWS = [
  persisted(1, { principal_due: 4000, interest_due: 240, remaining_balance: 0, principal_paid: 4000, interest_paid: 240, status: "paid", due_date: "2026-08-31" }),
  persisted(2, { principal_due: 4000, interest_due: 160, remaining_balance: 0, principal_paid: 1000, interest_paid: 160, status: "partial", due_date: "2026-09-30" }),
  persisted(3, { principal_due: 4000, interest_due: 80, remaining_balance: 0, status: "pending", due_date: "2026-10-31" }),
];

const DISPLAY = { isUponMaturity: false, totals: NO_SCHEDULE_TOTALS };

// ── what the server answered ──────────────────────────────────────────────

test("an empty server schedule is no rows, never a generated one", () => {
  // A restructure's release deletes every period nothing was paid on, so the
  // source loan's schedule is legitimately empty.
  const read = readScheduleRows([], 42);
  assert.deepEqual(read, { schedule: [], raw: null });
  assert.deepEqual(toDisplaySchedule(read!.schedule, DISPLAY), []);
  // The upon-maturity collapse reads the last row, of which there is none.
  assert.deepEqual(
    toDisplaySchedule(read!.schedule, { ...DISPLAY, isUponMaturity: true }),
    [],
  );
});

test("a payload that is not a list is unreadable, not empty", () => {
  assert.equal(readScheduleRows(undefined, 42), null);
  assert.equal(readScheduleRows(null, 42), null);
  assert.equal(readScheduleRows({ message: "Server Error" }, 42), null);
});

test("persisted rows map their *_due fields and fold the paid columns", () => {
  const read = readScheduleRows(ZERO_BALANCE_ROWS, 42)!;
  assert.deepEqual(read.schedule[1], {
    id: 502,
    loan_id: 42,
    due_date: "2026-09-30",
    principal: 4000,
    interest: 160,
    amount_due: 4160,
    amount_paid: 1160,
    balance: 0,
    status: "partial",
    share_capital_build_up: 50,
    total_payment: 4210,
  });
  // The raw rows are kept untouched for the figures that need interest_paid.
  assert.equal(read.raw, ZERO_BALANCE_ROWS as unknown);
});

test("the legacy { schedule } wrapper is still read", () => {
  const read = readScheduleRows({ schedule: ZERO_BALANCE_ROWS, summary: {} }, 42)!;
  assert.equal(read.schedule.length, 3);
});

// ── what the page draws from it ───────────────────────────────────────────

test("each row shows the server's build-up and total payment, never amount due plus build-up", () => {
  // Figures that do not add up on purpose: the page repeats the server's
  // total payment, it does not add the build-up to the amount due itself.
  const rows = toDisplaySchedule(
    readScheduleRows(
      [
        persisted(1, { principal_due: 4000, interest_due: 240, remaining_balance: 8000, status: "paid", due_date: "2026-08-31", share_capital_build_up: 100.5, total_payment: 4340.55 }),
        persisted(2, { principal_due: 4000, interest_due: 160, remaining_balance: 4000, status: "pending", due_date: "2026-09-30", share_capital_build_up: 0, total_payment: 4160 }),
      ],
      42,
    )!.schedule,
    DISPLAY,
  );
  assert.deepEqual(
    rows.map((r) => [r.period, r.principal, r.interest, r.shareCapitalBuildUp, r.totalPayment, r.balance, r.status]),
    [
      [1, 4000, 240, 100.5, 4340.55, 8000, "paid"],
      [2, 4000, 160, 0, 4160, 4000, "pending"],
    ],
  );
});

test("a row the server sent no build-up or total payment for shows neither, never a browser figure", () => {
  const bare: Record<string, unknown> = { ...ZERO_BALANCE_ROWS[2] };
  delete bare.share_capital_build_up;
  delete bare.total_payment;
  const read = readScheduleRows([bare], 42)!;
  assert.equal(read.schedule[0]?.share_capital_build_up, null);
  assert.equal(read.schedule[0]?.total_payment, null);
  const [row] = toDisplaySchedule(read.schedule, DISPLAY);
  assert.equal(row?.shareCapitalBuildUp, null);
  assert.equal(row?.totalPayment, null);
});

test("a zero server balance is shown as zero, never a browser running balance", () => {
  const rows = toDisplaySchedule(readScheduleRows(ZERO_BALANCE_ROWS, 42)!.schedule, DISPLAY);
  assert.deepEqual(
    rows.map((r) => [r.period, r.principal, r.interest, r.shareCapitalBuildUp, r.totalPayment, r.balance, r.status]),
    [
      [1, 4000, 240, 50, 4290, 0, "paid"],
      [2, 4000, 160, 50, 4210, 0, "partial"],
      [3, 4000, 80, 50, 4130, 0, "pending"],
    ],
  );
  assert.deepEqual(rows[2]?.dueDate, new Date("2026-10-31"));
});

test("a server balance above zero is shown as the server sent it", () => {
  const rows = toDisplaySchedule(
    readScheduleRows(
      [
        { ...ZERO_BALANCE_ROWS[0], remaining_balance: 7999 },
        ...ZERO_BALANCE_ROWS.slice(1),
      ],
      42,
    )!.schedule,
    DISPLAY,
  );
  assert.deepEqual(rows.map((r) => r.balance), [7999, 0, 0]);
});

test("after a balance adjustment the rows show the server's balance, not principal minus principal paid", () => {
  // A ₱9,000 loan in three ₱3,000 instalments, written down to zero after the
  // first: the server's remaining balance is 0 on the open rows, where
  // subtracting each row's principal from the loan amount would read ₱3,000.
  const rows = toDisplaySchedule(
    readScheduleRows(
      [
        persisted(1, { principal_due: 3000, interest_due: 270, remaining_balance: 6000, principal_paid: 3000, interest_paid: 270, status: "paid", due_date: "2026-11-15" }),
        persisted(2, { principal_due: 3000, interest_due: 0, remaining_balance: 0, status: "paid", due_date: "2026-12-15" }),
        persisted(3, { principal_due: 3000, interest_due: 0, remaining_balance: 0, status: "paid", due_date: "2027-01-15" }),
      ],
      42,
    )!.schedule,
    DISPLAY,
  );
  assert.deepEqual(rows.map((r) => r.balance), [6000, 0, 0]);
});

// ── the server's column totals ────────────────────────────────────────────

/** `LoanResource::scheduleTotals()` with the build-up columns. */
const SERVER_TOTALS = {
  principal: 10000,
  interest: 900.01,
  penalty: 0,
  total_due: 10900.01,
  amount_paid: 300,
  share_capital_build_up: 301.5,
  total_payment: 11201.52,
};

test("the totals are the server's amortization_schedule_totals, as sent", () => {
  assert.deepEqual(readScheduleTotals(SERVER_TOTALS), {
    principal: 10000,
    interest: 900.01,
    shareCapitalBuildUp: 301.5,
    totalPayment: 11201.52,
  });
});

test("a total the server did not send is null (a dash), never a sum of the rows", () => {
  const older: Record<string, unknown> = { ...SERVER_TOTALS };
  delete older.share_capital_build_up;
  delete older.total_payment;
  assert.deepEqual(readScheduleTotals(older), {
    principal: 10000,
    interest: 900.01,
    shareCapitalBuildUp: null,
    totalPayment: null,
  });
  for (const absent of [undefined, null, "n/a", []]) {
    assert.deepEqual(readScheduleTotals(absent), NO_SCHEDULE_TOTALS);
  }
  assert.deepEqual(NO_SCHEDULE_TOTALS, {
    principal: null,
    interest: null,
    shareCapitalBuildUp: null,
    totalPayment: null,
  });
});

test("an upon-maturity schedule collapses into one maturity payment of the server's totals", () => {
  // Two periods, as an extension leaves it: the settled first cycle's interest
  // and the open second one. The figures are the server's column totals, not
  // the rows added up here (they would give 600 interest, not 900.01).
  const rows = toDisplaySchedule(
    readScheduleRows(
      [
        persisted(1, { principal_due: 0, interest_due: 300, remaining_balance: 10000, interest_paid: 300, status: "paid", due_date: "2026-10-31" }),
        persisted(2, { principal_due: 10000, interest_due: 300, remaining_balance: 0, status: "pending", due_date: "2026-11-30" }),
      ],
      42,
    )!.schedule,
    { isUponMaturity: true, totals: readScheduleTotals(SERVER_TOTALS) },
  );
  assert.deepEqual(rows, [
    {
      period: 1,
      dueDate: new Date("2026-11-30"),
      principal: 10000,
      interest: 900.01,
      shareCapitalBuildUp: 301.5,
      totalPayment: 11201.52,
      balance: 0,
      status: "pending",
    },
  ]);
});

test("an upon-maturity collapse with no server totals shows dashes, never a browser sum", () => {
  const rows = toDisplaySchedule(
    readScheduleRows(
      [
        persisted(1, { principal_due: 0, interest_due: 300, remaining_balance: 10000, interest_paid: 300, status: "paid", due_date: "2026-10-31" }),
        persisted(2, { principal_due: 10000, interest_due: 300, remaining_balance: 0, status: "pending", due_date: "2026-11-30" }),
      ],
      42,
    )!.schedule,
    { isUponMaturity: true, totals: NO_SCHEDULE_TOTALS },
  );
  assert.deepEqual(
    rows.map((r) => [r.period, r.principal, r.interest, r.shareCapitalBuildUp, r.totalPayment, r.balance, r.status]),
    [[1, null, null, null, null, 0, "pending"]],
  );
});

// ── the pre-release preview ───────────────────────────────────────────────

/** `LoanService::buildStraight` output: no ids, no paid columns. */
const PREVIEW_ROWS = [
  { period_number: 1, due_date: "2026-11-15", principal_due: 3000, interest_due: 270, total_due: 3270, remaining_balance: 6000, status: "pending" },
  { period_number: 2, due_date: "2026-12-15", principal_due: 3000, interest_due: 270, total_due: 3270, remaining_balance: 3000, status: "pending" },
  { period_number: 3, due_date: "2027-01-15", principal_due: 3000, interest_due: 270, total_due: 3270, remaining_balance: 0, status: "pending" },
];

test("preview rows are read from their *_due fields", () => {
  // The page used to test the preview for `principal` / `interest`, which it
  // never carries, so the server's preview was always discarded.
  const { schedule } = readScheduleRows(PREVIEW_ROWS, 42)!;
  assert.deepEqual(schedule[0], {
    id: 0,
    loan_id: 42,
    due_date: "2026-11-15",
    principal: 3000,
    interest: 270,
    amount_due: 3270,
    amount_paid: 0,
    balance: 6000,
    status: "pending",
    share_capital_build_up: null,
    total_payment: null,
  });
});

test("a preview without the server's build-up shows no build-up and no total payment", () => {
  // `GET /loans/{id}/amortization-preview` sends neither column; the page
  // used to put the loan's build-up on every row and add it to the amount due.
  const rows = toDisplaySchedule(readScheduleRows(PREVIEW_ROWS, 42)!.schedule, DISPLAY);
  assert.deepEqual(
    rows.map((r) => [r.period, r.principal, r.interest, r.shareCapitalBuildUp, r.totalPayment, r.balance]),
    [
      [1, 3000, 270, null, null, 6000],
      [2, 3000, 270, null, null, 3000],
      [3, 3000, 270, null, null, 0],
    ],
  );
});

test("a single-payment preview stays one row at maturity, with the row's own figures", () => {
  const rows = toDisplaySchedule(
    readScheduleRows(
      [{ period_number: 1, due_date: "2026-12-01", principal_due: 5000, interest_due: 450, total_due: 5450, share_capital_build_up: 100, total_payment: 5550, remaining_balance: 0, status: "pending" }],
      42,
    )!.schedule,
    { isUponMaturity: true, totals: NO_SCHEDULE_TOTALS },
  );
  assert.deepEqual(
    rows.map((r) => [r.period, r.principal, r.interest, r.shareCapitalBuildUp, r.totalPayment, r.balance]),
    [[1, 5000, 450, 100, 5550, 0]],
  );
});

// ── the preview's envelope: { data: rows, totals } ────────────────────────

test("a preview with totals gives the server's totals, mapped onto the display shape", () => {
  // Totals that do not add up on purpose: they are read, never recomputed.
  const read = readPreviewResponse(
    {
      data: PREVIEW_ROWS,
      totals: { principal_due: 9000, interest_due: 810.01, total_due: 9810.01, share_capital_build_up: 75.5, total_payment: 9885.52 },
    },
    42,
  )!;
  assert.equal(read.schedule.length, 3);
  assert.deepEqual(read.totals, {
    principal: 9000,
    interest: 810.01,
    shareCapitalBuildUp: 75.5,
    totalPayment: 9885.52,
  });
});

test("a preview without totals gives dashes, never the rows added up", () => {
  assert.deepEqual(readPreviewResponse({ data: PREVIEW_ROWS }, 42)!.totals, NO_SCHEDULE_TOTALS);
  const partial = readPreviewResponse(
    { data: PREVIEW_ROWS, totals: { principal_due: 9000, interest_due: 810 } },
    42,
  )!;
  assert.deepEqual(partial.totals, {
    principal: 9000,
    interest: 810,
    shareCapitalBuildUp: null,
    totalPayment: null,
  });
});

test("a preview envelope with no row list is unreadable", () => {
  assert.equal(readPreviewResponse({ totals: {} }, 42), null);
  assert.equal(readPreviewResponse(undefined, 42), null);
  assert.equal(readPreviewResponse(PREVIEW_ROWS, 42), null);
});
