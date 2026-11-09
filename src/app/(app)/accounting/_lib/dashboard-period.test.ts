import { test } from "node:test";
import assert from "node:assert/strict";
import type { AccountingPeriodSummary } from "@/types";
import {
  currentPeriodText,
  dashboardFromError,
  defaultDashboardFrom,
  periodRangeLabel,
} from "./dashboard-period";

const PERIOD: AccountingPeriodSummary = {
  id: 4,
  code: "2026-11",
  name: "November 2026",
  start_date: "2026-11-01",
  end_date: "2026-11-30",
  status: "open",
};

test("the current period reads its name and status in words", () => {
  assert.equal(currentPeriodText(PERIOD), "November 2026 · Open");
  assert.equal(currentPeriodText({ ...PERIOD, status: "closed" }), "November 2026 · Closed");
});

test("no period covering the date says so", () => {
  assert.equal(currentPeriodText(null), "No accounting period covers this date");
  assert.equal(currentPeriodText(undefined), "No accounting period covers this date");
});

test("the period label names the server's own from and to", () => {
  assert.equal(
    periodRangeLabel({ from: "2026-11-01", to: "2026-11-09" }),
    "Nov 1, 2026 to Nov 9, 2026",
  );
  assert.equal(periodRangeLabel({ from: "2026-11-09", to: "2026-11-09" }), "Nov 9, 2026");
  assert.equal(periodRangeLabel(undefined), "");
});

test("From defaults to the first day of As of's month", () => {
  assert.equal(defaultDashboardFrom("2026-11-09"), "2026-11-01");
  assert.equal(defaultDashboardFrom("2026-02-28"), "2026-02-01");
  assert.equal(defaultDashboardFrom(""), "");
});

test("From after As of is refused before asking the server", () => {
  assert.equal(dashboardFromError("2026-11-01", "2026-11-09"), null);
  assert.equal(dashboardFromError("2026-11-09", "2026-11-09"), null);
  assert.equal(dashboardFromError("2026-11-10", "2026-11-09"), "From must be on or before As of.");
  assert.equal(dashboardFromError("", "2026-11-09"), "Choose a From date.");
  assert.equal(dashboardFromError("2026-11-01", ""), "Choose an As of date.");
});
