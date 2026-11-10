import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysISO,
  canPreterminate,
  canSettle,
  daysBetween,
  estimatePlacement,
  maturityHint,
  parseTermOptions,
  placementProblem,
  tdStatusTabs,
} from "./time-deposit-rules";

test("addDaysISO crosses months, years and leap days", () => {
  assert.equal(addDaysISO("2026-01-31", 30), "2026-03-02");
  assert.equal(addDaysISO("2026-12-15", 30), "2027-01-14");
  assert.equal(addDaysISO("2028-02-01", 28), "2028-02-29");
});

test("daysBetween counts calendar days and reads timestamps by their date", () => {
  assert.equal(daysBetween("2026-11-07", "2026-12-07"), 30);
  assert.equal(daysBetween("2026-11-07", "2026-11-05"), -2);
  assert.equal(daysBetween("2026-11-07T00:00:00Z", "2026-11-08"), 1);
});

test("estimatePlacement: 100,000 at 4% for 360 days, 20% tax", () => {
  const e = estimatePlacement(100_000, 4, 360, 20, "2026-11-07");
  assert.equal(e.grossInterest, 4000);
  assert.equal(e.withholdingTax, 800);
  assert.equal(e.netInterest, 3200);
  assert.equal(e.maturityAmount, 103_200);
  assert.equal(e.maturityDate, "2027-11-02");
});

test("estimatePlacement rounds to centavos and handles a tax-exempt product", () => {
  const e = estimatePlacement(12_345.67, 3.25, 91, 0, "2026-11-07");
  assert.equal(e.grossInterest, 101.42);
  assert.equal(e.withholdingTax, 0);
  assert.equal(e.maturityAmount, 12_447.09);
});

test("placementProblem enforces the product minimum", () => {
  assert.equal(placementProblem(null, null), "Enter the amount to place.");
  assert.match(placementProblem(4_000, { minimum_opening_balance: "5000.00" }) ?? "", /at least 5000\.00/);
  assert.equal(placementProblem(5_000, { minimum_opening_balance: 5000 }), null);
});

test("settle on or after maturity; pre-terminate only before it", () => {
  const td = { status: "active" as const, maturity_date: "2026-11-10" };
  assert.equal(canSettle(td, "2026-11-09"), false);
  assert.equal(canPreterminate(td, "2026-11-09"), true);
  assert.equal(canSettle(td, "2026-11-10"), true);
  assert.equal(canPreterminate(td, "2026-11-10"), false);
  assert.equal(canSettle({ status: "matured", maturity_date: "2026-11-10" }, "2026-11-01"), true);
  assert.equal(canSettle({ status: "withdrawn", maturity_date: "2026-11-10" }, "2026-12-01"), false);
  assert.equal(canPreterminate({ status: "rolled_over", maturity_date: "2027-01-01" }, "2026-11-01"), false);
});

test("maturityHint counts down, then counts overdue days, then goes quiet", () => {
  const md = "2026-11-10";
  assert.equal(maturityHint({ status: "active", maturity_date: md }, "2026-11-09"), "Matures in 1 day");
  assert.equal(maturityHint({ status: "active", maturity_date: md }, "2026-11-10"), "Matures today");
  assert.equal(maturityHint({ status: "matured", maturity_date: md }, "2026-11-13"), "Due 3 days ago");
  assert.equal(maturityHint({ status: "withdrawn", maturity_date: md }, "2026-11-13"), null);
});

test("parseTermOptions sorts and de-duplicates, and refuses junk", () => {
  assert.deepEqual(parseTermOptions("180, 30,90 ,30"), [30, 90, 180]);
  assert.equal(parseTermOptions(""), null);
  assert.equal(parseTermOptions("30, 0"), null);
  assert.equal(parseTermOptions("30, 1.5"), null);
});

test("tdStatusTabs totals every status", () => {
  const tabs = tdStatusTabs({ active: 4, matured: 1, withdrawn: 2 });
  assert.equal(tabs[0].count, 7);
  assert.deepEqual(tabs.map((t) => t.value), ["all", "active", "matured", "withdrawn", "rolled_over", "preterminated"]);
});
