/**
 * The month list's own actions beside a year-end close.
 *
 * WHAT THIS PROVES: an open month offers Close; a closed month offers Reopen,
 * unless a live year-end close closed it, when it says to reopen the year
 * instead; a refused reopen shows the server's words. WHAT IT DOES NOT PROVE:
 * that the server refuses the reopen (C3's tests), or the DOM (the page wiring
 * is pinned in its source below).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AccountingPeriod } from "@/types";
import { REOPEN_THE_YEAR, monthAction, periodReopenFailure } from "./month-actions";

const period = (id: number, status: AccountingPeriod["status"]): AccountingPeriod => ({
  id,
  code: "2025-12",
  name: "December 2025",
  start_date: "2025-12-01",
  end_date: "2025-12-31",
  status,
});

const labels = new Map([[12, "Closed by the 2025 year-end close"]]);

test("an open month offers Close, a closed one Reopen", () => {
  assert.equal(monthAction(period(1, "open"), labels), "close");
  assert.equal(monthAction(period(1, "closed"), labels), "reopen");
});

test("a month a live year-end close closed offers no Reopen, and says to reopen the year", () => {
  assert.equal(monthAction(period(12, "closed"), labels), "year");
  assert.equal(REOPEN_THE_YEAR, "Reopen the year to change this month");
});

test("a refused reopen shows the server's words; without them, the fallback", () => {
  const refused = {
    response: { status: 422, data: { message: "December 2025 was closed by the 2025 year-end close. Reopen the year instead." } },
  };
  assert.equal(
    periodReopenFailure(refused),
    "December 2025 was closed by the 2025 year-end close. Reopen the year instead.",
  );
  assert.equal(
    periodReopenFailure({ response: { status: 409, data: { message: "The period changed. Refresh and try again." } } }),
    "The period changed. Refresh and try again.",
  );
  assert.equal(periodReopenFailure(new Error("boom")), "Could not reopen this period.");
});

test("the page wires the month actions and the reopen refusal through these helpers", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/accounting/period-closing/page.tsx"), "utf8");
  assert.match(page, /monthAction\(period, yearEndLabels\)/);
  assert.match(page, /REOPEN_THE_YEAR/);
  assert.match(page, /toast\.error\(periodReopenFailure\(err\)\)/);
  assert.doesNotMatch(page, /toast\.error\("Could not reopen this period\."\)/);
});
