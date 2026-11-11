import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatCurrency } from "@/lib/report-format";
import { BUILD_UP_LABEL, OVERPAYMENT_LABEL, hasReceiptSplit, receiptExtraLines } from "./receipt-extras";

describe("a receipt's build-up and overpayment rows", () => {
  test("each gets its own row and label, from the server's two figures", () => {
    assert.deepEqual(receiptExtraLines({ build_up_credited: "250.00", overpayment_kept: "1200.50" }), [
      { label: BUILD_UP_LABEL, amount: formatCurrency(250) },
      { label: OVERPAYMENT_LABEL, amount: formatCurrency(1200.5) },
    ]);
    assert.equal(BUILD_UP_LABEL, "Share Capital Build-Up");
    assert.equal(OVERPAYMENT_LABEL, "Advance / Overpayment");
  });

  test("a row shows only when its figure is above ₱0.00", () => {
    assert.deepEqual(receiptExtraLines({ build_up_credited: "0.00", overpayment_kept: "75.25" }), [
      { label: OVERPAYMENT_LABEL, amount: formatCurrency(75.25) },
    ]);
    assert.deepEqual(receiptExtraLines({ build_up_credited: "0.00", overpayment_kept: 0 }), []);
  });

  test("a null figure shows a dash, never ₱0.00", () => {
    assert.deepEqual(receiptExtraLines({ build_up_credited: null, overpayment_kept: "0.00" }), [
      { label: BUILD_UP_LABEL, amount: "—" },
    ]);
  });

  test("an older backend that sends neither field shows nothing new", () => {
    const older = { overpayment: 500, scb_paid: 250, excess_amount: 500 };
    assert.equal(hasReceiptSplit(older), false);
    assert.deepEqual(receiptExtraLines(older), []);
    assert.deepEqual(receiptExtraLines(null), []);
    assert.equal(hasReceiptSplit({ overpayment_kept: null }), true);
  });

  test("the rows are the server's figures: no sums, differences or zero fallbacks", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/receipt-extras.ts"), "utf8");
    assert.doesNotMatch(source, /\?\?\s*0\b/);
    assert.doesNotMatch(source, /overpayment\b(?!_kept)|scb_paid|excess_amount/);
  });

  test("the on-screen receipt reads its rows from the same helper", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(app)/payments/[id]/page.tsx"), "utf8");
    assert.match(page, /receiptExtraLines\(/);
  });
});
