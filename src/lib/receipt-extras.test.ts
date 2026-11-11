import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatCurrency } from "@/lib/report-format";
import {
  BUILD_UP_LABEL,
  COMBINED_LABEL,
  OVERPAYMENT_LABEL,
  hasReceiptSplit,
  receiptExtraLines,
} from "./receipt-extras";

describe("a receipt's build-up and overpayment rows", () => {
  test("each gets its own row and label, from the server's two figures", () => {
    const payment = { overpayment: 1450.5, build_up_credited: "250.00", overpayment_kept: "1200.50" };
    assert.deepEqual(receiptExtraLines(payment), [
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
    assert.deepEqual(receiptExtraLines({ overpayment: 0, build_up_credited: "0.00", overpayment_kept: 0 }), []);
  });

  test("one figure and one null: the split as sent, the null a dash", () => {
    const payment = { overpayment: 750, build_up_credited: null, overpayment_kept: "500.00" };
    assert.equal(hasReceiptSplit(payment), true);
    assert.deepEqual(receiptExtraLines(payment), [
      { label: BUILD_UP_LABEL, amount: "—" },
      { label: OVERPAYMENT_LABEL, amount: formatCurrency(500) },
    ]);
  });

  test("both null (the server can't tell the parts apart): the combined figure, one line, no dashes", () => {
    const payment = { overpayment: 750, build_up_credited: null, overpayment_kept: null };
    assert.equal(hasReceiptSplit(payment), false);
    assert.deepEqual(receiptExtraLines(payment), [{ label: COMBINED_LABEL, amount: formatCurrency(750) }]);
    assert.equal(COMBINED_LABEL, "Build-Up / Overpayment");
  });

  test("an older backend that sends neither field keeps its one combined line", () => {
    const older = { overpayment: 500, scb_paid: 250, excess_amount: 500 };
    assert.equal(hasReceiptSplit(older), false);
    assert.deepEqual(receiptExtraLines(older), [{ label: COMBINED_LABEL, amount: formatCurrency(500) }]);
    assert.deepEqual(receiptExtraLines({ excess_amount: "300.00" }), [{ label: COMBINED_LABEL, amount: formatCurrency(300) }]);
    assert.deepEqual(receiptExtraLines({ overpayment: 0 }), []);
    assert.deepEqual(receiptExtraLines(null), []);
  });

  test("the rows are the server's figures: no sums, differences or zero fallbacks", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/receipt-extras.ts"), "utf8");
    assert.doesNotMatch(source, /\?\?\s*0\b/);
    assert.doesNotMatch(source, /scb_paid/);
  });

  test("the on-screen receipt reads its rows from the same helper", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(app)/payments/[id]/page.tsx"), "utf8");
    assert.match(page, /receiptExtraLines\(/);
  });
});
