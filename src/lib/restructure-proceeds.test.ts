/**
 * What a loan pays out, as the loan page's card and the loan form show it. A
 * restructure pays nothing out: its deductions are collected from the member
 * at release (A1), so it shows what is collected and "Paid out ₱0.00" in place
 * of Net Proceeds, as the release dialog does.
 *
 * WHAT THIS PROVES: an ordinary loan shows Net Proceeds; a restructure shows
 * the server's collected figure (the release preview's `collected_now` when it
 * sent one, else its total deductions) and Paid out, the server's `paid_out`
 * when sent; a missing figure is a dash.
 * WHAT IT DOES NOT PROVE: the figures themselves (backend tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { proceedsFigures } from "./restructure-proceeds";

test("an ordinary loan shows Net Proceeds", () => {
  assert.deepEqual(proceedsFigures(false, { totalDeductions: "850.00", netProceeds: "19150.00" }), [
    { label: "Net Proceeds", amount: "19150.00" },
  ]);
});

test("a restructure shows what is collected from the member and what is paid out", () => {
  assert.deepEqual(proceedsFigures(true, { totalDeductions: "850.00", netProceeds: "18816.67" }), [
    { label: "Collected from the member", amount: "850.00" },
    { label: "Paid out", amount: 0 },
  ]);
});

test("the release preview's restructure block wins when it was sent", () => {
  assert.deepEqual(
    proceedsFigures(true, {
      totalDeductions: "850.00",
      netProceeds: "18816.67",
      restructure: { collected_now: "900.00", paid_out: "0.00" },
    }),
    [
      { label: "Collected from the member", amount: "900.00" },
      { label: "Paid out", amount: "0.00" },
    ],
  );
});

test("a figure the server didn't send is null, never worked out", () => {
  assert.deepEqual(proceedsFigures(true, { totalDeductions: null, netProceeds: null })[0], {
    label: "Collected from the member",
    amount: null,
  });
  assert.deepEqual(proceedsFigures(false, { totalDeductions: null, netProceeds: undefined }), [
    { label: "Net Proceeds", amount: null },
  ]);
});

test("the loan page's card and the loan form both use it", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  const form = readFileSync(join(process.cwd(), "src/app/(app)/loans/new/page.tsx"), "utf8");
  assert.ok(page.includes("proceedsFigures(!!loan.is_restructure"));
  assert.ok(form.includes("proceedsFigures(isRestructureEdit"));
});
