/**
 * What a loan pays out, as the loan page's card and the loan form show it. A
 * restructure pays nothing out: its deductions are collected from the member
 * at release (A1), so it shows what is collected and "Paid out ₱0.00" in place
 * of Net Proceeds, as the release dialog does.
 *
 * WHAT THIS PROVES: an ordinary loan shows Net Proceeds; a restructure shows
 * the server's collected figure and Paid out. Once a preview's `restructure`
 * block has come back (the release preview, or POST /loans/preview with
 * `source_loan_id`), both are its `collected_now` and `paid_out` and nothing
 * else: a figure it left out is a dash, never the total deductions or ₱0.00.
 * Without that block (a released loan's recorded figures) the loan's total
 * deductions are what was collected. A missing figure is a dash.
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

test("once the server's restructure block is back, a figure it left out is a dash, never a browser figure", () => {
  assert.deepEqual(
    proceedsFigures(true, { totalDeductions: "850.00", netProceeds: "18816.67", restructure: {} }),
    [
      { label: "Collected from the member", amount: null },
      { label: "Paid out", amount: null },
    ],
  );
  assert.deepEqual(
    proceedsFigures(true, {
      totalDeductions: "850.00",
      netProceeds: null,
      restructure: { collected_now: "0.00", paid_out: undefined },
    }),
    [
      { label: "Collected from the member", amount: "0.00" },
      { label: "Paid out", amount: null },
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

test("preview not loaded: both dashes, never a ₱0.00 before the server answers", () => {
  assert.deepEqual(proceedsFigures(true, { totalDeductions: null, netProceeds: null }), [
    { label: "Collected from the member", amount: null },
    { label: "Paid out", amount: null },
  ]);
  assert.deepEqual(proceedsFigures(true, { totalDeductions: undefined, netProceeds: undefined, restructure: null }), [
    { label: "Collected from the member", amount: null },
    { label: "Paid out", amount: null },
  ]);
});

test("the loan page's card and the loan form both use it", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  const form = readFileSync(join(process.cwd(), "src/app/(app)/loans/new/page.tsx"), "utf8");
  assert.ok(page.includes("proceedsFigures(!!loan.is_restructure"));
  assert.ok(form.includes("proceedsFigures(isRestructureEdit"));
  // The edit form's one preview names the source loan, so its block is the server's too.
  assert.match(form, /proceedsFigures\(isRestructureEdit, \{[\s\S]*?restructure: previewRestructure,[\s\S]*?\}\)/);
});

test("the restructure page shows what is collected and paid out, never Net Proceeds", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/restructure/page.tsx"), "utf8");
  assert.ok(page.includes("proceedsFigures(true, {"));
  // The preview's own restructure block, sent because the request names the source loan.
  assert.match(page, /proceedsFigures\(true, \{[\s\S]*?restructure: previewRestructure,[\s\S]*?\}\)/);
  assert.match(page, /const previewRestructure =\s*preview\.status === "ready" \? \(preview\.preview\.restructure \?\? null\) : null;/);
  assert.ok(!page.includes("Net Proceeds"));
  assert.ok(!page.includes("net_proceeds"));
});
