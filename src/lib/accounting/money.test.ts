import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toCentavos,
  fromCentavos,
  formatCentavos,
  sumCentavos,
  isBalanced,
} from "./money";

test("parses a plain peso amount", () => {
  assert.equal(toCentavos("1500.50"), 150050);
});

test("parses grouped input the way a person types it", () => {
  assert.equal(toCentavos("1,500.50"), 150050);
  assert.equal(toCentavos("₱1,500.50"), 150050);
  assert.equal(toCentavos(" 1 500.50 "), 150050);
});

test("accepts numbers as well as strings", () => {
  assert.equal(toCentavos(1500.5), 150050);
  assert.equal(toCentavos(0), 0);
});

test("treats blank as absent, not as zero", () => {
  // A blank debit box and a debit of ₱0.00 are different statements: one says
  // "this side is unused", the other says "this side is zero". The manual
  // entry form needs to tell them apart to know which side a line is on.
  assert.equal(toCentavos(""), null);
  assert.equal(toCentavos("   "), null);
  assert.equal(toCentavos(null), null);
  assert.equal(toCentavos(undefined), null);
});

test("rejects text that is not a number", () => {
  assert.equal(toCentavos("abc"), null);
  assert.equal(toCentavos("1.2.3"), null);
  assert.equal(toCentavos("--5"), null);
});

test("rejects a negative amount", () => {
  // Direction is carried by which column the amount sits in, never by its
  // sign. A negative debit is really a credit, and allowing both spellings
  // means two entries that look different post identically.
  assert.equal(toCentavos("-100"), null);
});

test("rounds half away from zero at the centavo", () => {
  assert.equal(toCentavos("0.005"), 1);
  assert.equal(toCentavos("0.004"), 0);
  assert.equal(toCentavos("1.555"), 156);
});

test("survives the float that breaks naive peso arithmetic", () => {
  // 0.1 + 0.2 === 0.30000000000000004 in pesos. In centavos it is just 30.
  const a = toCentavos("0.10");
  const b = toCentavos("0.20");
  assert.equal(sumCentavos([a, b]), 30);
  assert.equal(sumCentavos([a, b]), toCentavos("0.30"));
});

test("a thousand small amounts still sum exactly", () => {
  const cents = Array.from({ length: 1000 }, () => toCentavos("0.01") ?? 0);
  assert.equal(sumCentavos(cents), 1000);
  assert.equal(fromCentavos(sumCentavos(cents)), 10);
});

test("converts back to pesos for display", () => {
  assert.equal(fromCentavos(150050), 1500.5);
  assert.equal(fromCentavos(0), 0);
  assert.equal(fromCentavos(1), 0.01);
});

test("formats as pesos with two decimals", () => {
  assert.equal(formatCentavos(150050), "₱1,500.50");
  assert.equal(formatCentavos(0), "₱0.00");
  assert.equal(formatCentavos(-150050), "-₱1,500.50");
});

test("sum ignores absent values", () => {
  assert.equal(sumCentavos([100, null, 200, undefined]), 300);
  assert.equal(sumCentavos([]), 0);
});

test("balance check is exact", () => {
  assert.equal(isBalanced(150050, 150050), true);
  assert.equal(isBalanced(150050, 150049), false);
  assert.equal(isBalanced(0, 0), true);
});

// ── Amounts as they actually arrive off the wire ──
//
// Laravel's `decimal:2` cast serialises to a JSON STRING. Every centavo field
// in this module is typed `number` on the strength of a contract no compiler
// checks at the boundary, so the types said this could not happen while the
// responses said otherwise.

test("REGRESSION: a numeric string used to be skipped, silently", () => {
  // `formatCentavos` coerces through arithmetic, so each card on Cash & Bank
  // rendered correctly while the total beside them read ₱0.00. The rows and
  // their own total disagreed on screen, and nothing said which was wrong.
  const wire = ["150050", "250000"] as unknown as number[];
  assert.equal(formatCentavos(Number(wire[0])), "₱1,500.50");
  assert.equal(sumCentavos(wire), 400050);
});

test("string and number amounts mix without loss", () => {
  const mixed = [150050, "250000", 99] as unknown as number[];
  assert.equal(sumCentavos(mixed), 400149);
});

test("a decimal string from a `decimal:2` column still lands on the centavo", () => {
  // The realistic serialisation of an integer centavo column with scale 2.
  assert.equal(sumCentavos(["150050.00", "1.00"] as unknown as number[]), 150051);
});

test("blank and absent values are skipped, not counted as zero-length text", () => {
  const values = [100, "", null, undefined, 200] as unknown as number[];
  assert.equal(sumCentavos(values), 300);
});

test("unparseable amounts are skipped rather than poisoning the total with NaN", () => {
  // Matches `toShareCapitalBalance`'s house rule: one bad row must not turn a
  // money figure into "₱NaN".
  const values = [100, "not a number", 200] as unknown as number[];
  assert.equal(sumCentavos(values), 300);
  assert.ok(Number.isFinite(sumCentavos(values)));
});

test("non-finite values are skipped", () => {
  const values = [100, Infinity, -Infinity, NaN, 200] as unknown as number[];
  assert.equal(sumCentavos(values), 300);
});

test("negative amounts still subtract — this is a sum, not a validator", () => {
  // `expenses/page.tsx` sums `amount - amount_paid`, which is legitimately
  // negative on an overpaid expense.
  assert.equal(sumCentavos([100000, -25000]), 75000);
  assert.equal(sumCentavos(["-25000"] as unknown as number[]), -25000);
});

test("sub-centavo dust is resolved per value instead of accumulating", () => {
  // A centavo is the smallest unit that exists here, so a fraction of one is
  // already corrupt. Rounding each value keeps the total comparable by exact
  // equality against `isBalanced`, which has no tolerance band.
  assert.equal(sumCentavos([0.5, 0.5] as unknown as number[]), 2);
  assert.ok(Number.isInteger(sumCentavos([100.4, 99.6] as unknown as number[])));
});

test("integers are untouched, so every existing caller is unaffected", () => {
  assert.equal(sumCentavos([1, 2, 3]), 6);
  assert.equal(sumCentavos([150050]), 150050);
  assert.equal(sumCentavos([]), 0);
});

test("a drained list of string balances totals what the cards show", () => {
  // The Cash & Bank screen, end to end: six money accounts off the wire.
  const balances = ["52000000", "125000000", "3500000"] as unknown as number[];
  const total = sumCentavos(balances);
  assert.equal(total, 180500000);
  assert.equal(formatCentavos(total), "₱1,805,000.00");
});
