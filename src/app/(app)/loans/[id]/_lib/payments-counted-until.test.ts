import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  countedUntilHint,
  firstPaymentDay,
  paymentDateRefusal,
  paymentDayBlocked,
  paymentsCountedUntil,
} from "./payments-counted-until";

test("the as-of date is read from the loan only when it is a calendar day", () => {
  assert.equal(paymentsCountedUntil({ payments_counted_until: "2026-06-30" }), "2026-06-30");
  for (const loan of [{ payments_counted_until: null }, { payments_counted_until: "" }, { payments_counted_until: "2026-06-30T00:00:00Z" }, {}, null, undefined]) {
    assert.equal(paymentsCountedUntil(loan), null, JSON.stringify(loan));
  }
});

test("the as-of date and every day before it are blocked; the day after is open", () => {
  assert.equal(paymentDayBlocked("2026-06-30", "2026-06-30"), true);
  assert.equal(paymentDayBlocked("2026-01-01", "2026-06-30"), true);
  assert.equal(paymentDayBlocked("2026-07-01", "2026-06-30"), false);
  assert.equal(paymentDayBlocked("2026-06-30", null), false);
  assert.equal(paymentDayBlocked("", "2026-06-30"), false);
});

test("the hint names the as-of date in words, the same on any computer", () => {
  assert.equal(countedUntilHint("2026-06-30"), "The imported file counts payments up to Jun 30, 2026");
  assert.equal(countedUntilHint("2026-01-05"), "The imported file counts payments up to Jan 5, 2026");
  assert.equal(countedUntilHint(null), null);
});

test("the first open day is the day after, across month and year ends", () => {
  assert.equal(firstPaymentDay("2026-06-30"), "2026-07-01");
  assert.equal(firstPaymentDay("2026-12-31"), "2027-01-01");
  assert.equal(firstPaymentDay("2028-02-28"), "2028-02-29");
  assert.equal(firstPaymentDay(null), null);
});

test("the server's refusal on the payment date is picked out for the field", () => {
  const words = "This loan's imported file already counts payments up to Jun 30, 2026. Record only payments made after that date.";
  assert.equal(paymentDateRefusal({ payment_date: [words] }), words);
  assert.equal(paymentDateRefusal({ amount_paid: ["x"] }), null);
  assert.equal(paymentDateRefusal(null), null);
});

test("Record Payment and Payment Entry block the counted days and show the hint and refusal under the date", () => {
  const loanPage = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  assert.match(loanPage, /disabled=\{\(day\) => paymentDayBlocked\(formatDateISO\(day\), countedUntil\)\}/);
  assert.match(loanPage, /countedUntilHint\(countedUntil\)/);
  assert.match(loanPage, /id="payment-date-error"/);

  const entry = readFileSync(join(process.cwd(), "src/app/(app)/payments/page.tsx"), "utf8");
  assert.match(entry, /min=\{firstPaymentDay\(entryCountedUntil\) \?\? undefined\}/);
  assert.match(entry, /countedUntilHint\(entryCountedUntil\)/);
  assert.match(entry, /id="payment-date-error"/);
});

test("Payment Entry's loan carries the as-of date from the server's row", async () => {
  const { mapLoanToActiveLoan } = await import("@/app/(app)/payments/_lib/active-loans");
  const row = { id: 4, status: "ongoing", payments_counted_until: "2026-06-30" } as Parameters<typeof mapLoanToActiveLoan>[0];
  assert.equal(paymentsCountedUntil(mapLoanToActiveLoan(row)), "2026-06-30");
  assert.equal(mapLoanToActiveLoan({ id: 5, status: "ongoing" } as Parameters<typeof mapLoanToActiveLoan>[0]).payments_counted_until, null);
});
