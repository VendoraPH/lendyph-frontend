import { test } from "node:test";
import assert from "node:assert/strict";
import { formatValue } from "@/lib/report-format";
import {
  BLANK_LINE,
  annualRateLabel,
  dateField,
  dateOrBlank,
  dateTimeField,
  field,
  parseApiDate,
  periodsPerYear,
  rateLabel,
  startOfLocalDay,
  termLabel,
  termLabelFrom,
  unitemisedRemainder,
} from "./shared";

/**
 * Every frequency `loans.frequency` can hold, and the rate phrase and
 * annualisation it gets. The templates used to hardcode "per month" and "× 12".
 */
const FREQUENCIES = [
  { frequency: "daily", periods: 365, rate: "1% per day", annual: "365.00% per annum" },
  { frequency: "weekly", periods: 52, rate: "1% per week", annual: "52.00% per annum" },
  { frequency: "bi_weekly", periods: 26, rate: "1% per bi-weekly period", annual: "26.00% per annum" },
  { frequency: "semi_monthly", periods: 24, rate: "1% per semi-monthly period", annual: "24.00% per annum" },
  { frequency: "monthly", periods: 12, rate: "1% per month", annual: "12.00% per annum" },
  { frequency: "upon_maturity", periods: 12, rate: "1% per month", annual: "12.00% per annum" },
] as const;

for (const spec of FREQUENCIES) {
  test(`frequency: ${spec.frequency} labels its own rate and annual rate`, () => {
    assert.equal(periodsPerYear(spec.frequency), spec.periods);
    assert.equal(rateLabel(1, spec.frequency), spec.rate);
    assert.equal(annualRateLabel(1, spec.frequency), spec.annual);
  });
}

test("term: labelled by its own unit, never by the payment frequency", () => {
  // `term` is a length in `term_unit` — a 30-day loan paid weekly is still
  // "30 day(s)", not "30 week(s)".
  assert.equal(termLabel(30, "days"), "30 day(s)");
  assert.equal(termLabel(6, "months"), "6 month(s)");
});

test("frequency: a 1%-per-day loan discloses 365%, not 12%", () => {
  // The headline case. `${(rate * 12).toFixed(2)}% per annum` disclosed a
  // 365% nominal as 12.00% — on the one document whose statutory purpose
  // (R.A. 3765) is to state the annual rate correctly.
  assert.equal(annualRateLabel(1, "daily"), "365.00% per annum");
  assert.notEqual(annualRateLabel(1, "daily"), "12.00% per annum");

  // And a 2.5% weekly loan is 130%, not 30%.
  assert.equal(annualRateLabel(2.5, "weekly"), "130.00% per annum");
});

test("rate: a fractional rate is stated and annualised without rounding", () => {
  assert.equal(rateLabel(1.75, "monthly"), "1.75% per month");
  assert.equal(annualRateLabel(1.5, "monthly"), "18.00% per annum");
  assert.equal(annualRateLabel(1.75, "monthly"), "21.00% per annum");
  assert.equal(annualRateLabel(1.125, "monthly"), "13.50% per annum");
  // Not 13.48%: every stored place of the rate carries into the annual figure.
  assert.equal(annualRateLabel(1.1234, "monthly"), "13.4808% per annum");
  assert.equal(annualRateLabel(0.0125, "daily"), "4.5625% per annum");
});

test("rate: a four-digit annual rate prints without a thousands separator", () => {
  assert.equal(annualRateLabel(3, "daily"), "1095.00% per annum");
});

test("frequency: an unknown frequency annualises to nothing at all", () => {
  // A rule to be completed by hand beats a confident wrong figure — `field()`
  // turns null into exactly that.
  assert.equal(periodsPerYear("quarterly"), null);
  assert.equal(annualRateLabel(3, "quarterly"), null);
  assert.equal(annualRateLabel(3, null), null);
  assert.deepEqual(field("Nominal Annual Rate", annualRateLabel(3, null)), {
    label: "Nominal Annual Rate",
    underline: true,
  });

  // The periodic figure stays printable, in neutral units.
  assert.equal(rateLabel(3, "quarterly"), "3% per period");
  // An unknown term unit is months, the backend's default.
  assert.equal(termLabel(4, "quarterly"), "4 month(s)");
});

test("frequency: casing and absent values are tolerated", () => {
  assert.equal(termLabel(6, "MONTHS"), "6 month(s)");
  assert.equal(termLabel(45, " Days "), "45 day(s)");
  assert.equal(termLabel(6, undefined), "6 month(s)");
  assert.equal(rateLabel(2, " Daily "), "2% per day");
  assert.equal(termLabel(null, "days"), null);
  assert.equal(rateLabel(null, "daily"), null);
});

test("frequency: term takes its payload's term_unit; term_months names its own", () => {
  assert.equal(termLabelFrom({ term: 12, term_unit: "days", frequency: "weekly" }), "12 day(s)");
  // No unit on the payload: months, the backend's default.
  assert.equal(termLabelFrom({ term: 12, frequency: "daily" }), "12 month(s)");
  // `term_months` only ever appears in the legacy flat payload shapes, where it
  // says months in its name.
  assert.equal(termLabelFrom({ term_months: 12 }), "12 month(s)");
  // And `term` wins when a payload somehow carries both.
  assert.equal(termLabelFrom({ term: 30, term_unit: "days", term_months: 12 }), "30 day(s)");
  assert.equal(termLabelFrom({}), null);
  assert.equal(termLabelFrom(null), null);
});

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

test("dates: a YYYY-MM-DD is the local calendar day it names", () => {
  // `new Date("2026-08-26")` is UTC midnight — 08:00 in Manila — which is what
  // made day arithmetic depend on the hour of the day it ran.
  const parsed = parseApiDate("2026-08-26");
  assert.ok(parsed);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 7);
  assert.equal(parsed.getDate(), 26);
  assert.equal(parsed.getHours(), 0);
  assert.equal(parsed.getTime(), new Date(2026, 7, 26).getTime());
});

test("dates: timestamps, Date objects and junk all round-trip sensibly", () => {
  const stamp = parseApiDate("2026-08-27 10:02:00");
  assert.ok(stamp);
  assert.equal(stamp.getHours(), 10);
  assert.equal(stamp.getMinutes(), 2);

  const now = new Date(2026, 7, 26, 13, 45);
  assert.equal(parseApiDate(now)?.getTime(), now.getTime());

  assert.equal(parseApiDate(null), null);
  assert.equal(parseApiDate(""), null);
  assert.equal(parseApiDate("not a date"), null);
  assert.equal(parseApiDate(new Date("nope")), null);
});

test("dates: startOfLocalDay drops the time and nothing else", () => {
  const floored = startOfLocalDay(new Date(2026, 7, 26, 23, 59, 59, 999));
  assert.equal(floored.getTime(), new Date(2026, 7, 26).getTime());
});

test("dates: a fields row formats the date instead of printing the API string", () => {
  // The bug: `field()` stringifies, so one receipt carried "Date: 2026-08-26"
  // in its fields block and "Date: Aug 26, 2026" in the signature detail
  // underneath.
  assert.deepEqual(dateField("Date", "2026-08-26"), {
    label: "Date",
    value: formatValue(new Date(2026, 7, 26), "date"),
  });
  assert.equal(dateField("Date", "2026-08-26").value, dateOrBlank("2026-08-26"));
  assert.notEqual(dateField("Date", "2026-08-26").value, "2026-08-26");

  // Missing dates draw a rule, exactly as `field()` does.
  assert.deepEqual(dateField("Date", null), { label: "Date", underline: true });
  assert.deepEqual(dateField("Date", ""), { label: "Date", underline: true });

  // Unparseable values are shown rather than silently dropped.
  assert.equal(dateField("Date", "sometime").value, "sometime");
});

test("dates: dateTimeField keeps the minute a void happened at", () => {
  assert.equal(
    dateTimeField("Voided on", "2026-08-27 10:02:00").value,
    formatValue(new Date(2026, 7, 27, 10, 2), "datetime")
  );
  assert.notEqual(
    dateTimeField("Voided on", "2026-08-27 10:02:00").value,
    "2026-08-27 10:02:00"
  );
  assert.equal(dateOrBlank(null), BLANK_LINE);
});

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

test("reconciliation: the unitemised remainder is exact to the centavo", () => {
  assert.equal(unitemisedRemainder(5000, 0), 5000);
  assert.equal(unitemisedRemainder(5000, 5000), 0);
  assert.equal(unitemisedRemainder(1500, 2000), -500);
  // Float subtraction would leave 0.009999999999990905 here, which is not zero
  // and would print a balancing line for a rounding artefact.
  assert.equal(unitemisedRemainder(1000.01, 1000), 0.01);
  assert.equal(unitemisedRemainder(16666.67, 6666.67 + 10000), 0);
});
