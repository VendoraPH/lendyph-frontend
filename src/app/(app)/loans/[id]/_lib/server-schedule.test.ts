import { test } from "node:test";
import assert from "node:assert/strict";
import { readScheduleRows, toDisplaySchedule } from "./server-schedule";

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
  ...row,
});

/** A server schedule whose `remaining_balance` came back 0 on every row. */
const ZERO_BALANCE_ROWS = [
  persisted(1, { principal_due: 4000, interest_due: 240, remaining_balance: 0, principal_paid: 4000, interest_paid: 240, status: "paid", due_date: "2026-08-31" }),
  persisted(2, { principal_due: 4000, interest_due: 160, remaining_balance: 0, principal_paid: 1000, interest_paid: 160, status: "partial", due_date: "2026-09-30" }),
  persisted(3, { principal_due: 4000, interest_due: 80, remaining_balance: 0, status: "pending", due_date: "2026-10-31" }),
];

const DISPLAY = { principalAmount: 12000, scb: 50, isUponMaturity: false };

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
  });
  // The raw rows are kept untouched for the figures that need interest_paid.
  assert.equal(read.raw, ZERO_BALANCE_ROWS as unknown);
});

test("the legacy { schedule } wrapper is still read", () => {
  const read = readScheduleRows({ schedule: ZERO_BALANCE_ROWS, summary: {} }, 42)!;
  assert.equal(read.schedule.length, 3);
});

// ── what the page draws from it ───────────────────────────────────────────

test("a zero server balance falls back to the running principal balance", () => {
  const rows = toDisplaySchedule(readScheduleRows(ZERO_BALANCE_ROWS, 42)!.schedule, DISPLAY);
  assert.deepEqual(
    rows.map((r) => [r.period, r.principal, r.interest, r.shareCapitalBuildUp, r.totalPayment, r.balance, r.status, r.amountPaid]),
    [
      [1, 4000, 240, 50, 4290, 8000, "paid", 4240],
      [2, 4000, 160, 50, 4210, 4000, "partial", 1160],
      [3, 4000, 80, 50, 4130, 0, "pending", 0],
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
  assert.deepEqual(rows.map((r) => r.balance), [7999, 4000, 0]);
});

test("an upon-maturity schedule collapses into one maturity payment", () => {
  // Two periods, as an extension leaves it: the settled first cycle's interest
  // and the open second one.
  const rows = toDisplaySchedule(
    readScheduleRows(
      [
        persisted(1, { principal_due: 0, interest_due: 300, remaining_balance: 10000, interest_paid: 300, status: "paid", due_date: "2026-10-31" }),
        persisted(2, { principal_due: 10000, interest_due: 300, remaining_balance: 0, status: "pending", due_date: "2026-11-30" }),
      ],
      42,
    )!.schedule,
    { principalAmount: 10000, scb: 100, isUponMaturity: true },
  );
  assert.deepEqual(rows, [
    {
      period: 1,
      dueDate: new Date("2026-11-30"),
      principal: 10000,
      interest: 600,
      shareCapitalBuildUp: 200,
      totalPayment: 10800,
      balance: 0,
      status: "pending",
      amountPaid: 300,
    },
  ]);
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
  });
});

test("a preview is drawn with the loan's build-up on every row", () => {
  const rows = toDisplaySchedule(readScheduleRows(PREVIEW_ROWS, 42)!.schedule, {
    principalAmount: 9000,
    scb: 25,
    isUponMaturity: false,
  });
  assert.deepEqual(
    rows.map((r) => [r.period, r.principal, r.interest, r.shareCapitalBuildUp, r.totalPayment, r.balance, r.amountPaid]),
    [
      [1, 3000, 270, 25, 3295, 6000, 0],
      [2, 3000, 270, 25, 3295, 3000, 0],
      [3, 3000, 270, 25, 3295, 0, 0],
    ],
  );
});

test("a single-payment preview stays one row at maturity", () => {
  const rows = toDisplaySchedule(
    readScheduleRows(
      [{ period_number: 1, due_date: "2026-12-01", principal_due: 5000, interest_due: 450, total_due: 5450, remaining_balance: 0, status: "pending" }],
      42,
    )!.schedule,
    { principalAmount: 5000, scb: 100, isUponMaturity: true },
  );
  assert.deepEqual(
    rows.map((r) => [r.period, r.principal, r.interest, r.shareCapitalBuildUp, r.totalPayment, r.balance]),
    [[1, 5000, 450, 100, 5550, 0]],
  );
});
