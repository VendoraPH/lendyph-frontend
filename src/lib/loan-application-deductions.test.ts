import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applicationDeductions,
  feePercent,
  productDeductionFields,
  storedDeductionFields,
  storedDeductionInputs,
  type DeductionFields,
  type ProductFees,
} from "./loan-application-deductions";
import type { LoanDeduction } from "./loan-restructure";
import type { LoanDeduction as StoredDeduction } from "@/types/loan";

/** A product as the API sends it: `decimal:4` columns arrive as padded strings. */
const PRODUCT: ProductFees = {
  processing_fee: "1.5000",
  service_fee: "2.5000",
  notarial_fee: "1.0000",
};

/**
 * What `LoanService::createLoan()` adds itself when a request states no
 * deductions, reproduced line for line.
 */
function serverAutoAdd(product: ProductFees): LoanDeduction[] {
  const items: LoanDeduction[] = [];
  if (Number(product.processing_fee) > 0) {
    items.push({ name: "Processing Fee", amount: Number(product.processing_fee), type: "percentage" });
  }
  if (Number(product.service_fee) > 0) {
    items.push({ name: "Service Fee", amount: Number(product.service_fee), type: "percentage" });
  }
  if (Number(product.notarial_fee ?? 0) > 0) {
    items.push({ name: "Notarial Fee", amount: Number(product.notarial_fee), type: "percentage" });
  }
  return items;
}

/** The deductions the form sends when its fields are left as `fields`. */
function sent(fields: DeductionFields, product: ProductFees = PRODUCT): LoanDeduction[] {
  return applicationDeductions({
    processingFeePercent: feePercent(fields.processingFeeRate, product.processing_fee),
    serviceFeePercent: feePercent(fields.serviceFeeRate, product.service_fee),
    otherDeductions: fields.otherDeductions,
    carried: fields.carried,
  });
}

/**
 * `LoanService::computeDeductions` items, as a saved loan reads back: `pesos`
 * are the server's amounts, the rate or fixed pesos stay in `original_value`.
 */
function stored(items: LoanDeduction[], pesos: number[]): StoredDeduction[] {
  return items.map((d, i) => ({ ...d, amount: pesos[i], original_value: d.amount }));
}

// ── A new application ──────────────────────────────────────────────────────

test("a product's fees start the form exactly, the notarial fee carried", () => {
  assert.deepEqual(productDeductionFields(PRODUCT), {
    processingFeeRate: "1.5",
    serviceFeeRate: "2.5",
    otherDeductions: [],
    carried: [{ name: "Notarial Fee", amount: 1, type: "percentage" }],
  });
});

test("a product with no notarial fee carries nothing", () => {
  assert.deepEqual(productDeductionFields({ ...PRODUCT, notarial_fee: "0.0000" }).carried, []);
  assert.deepEqual(productDeductionFields({ ...PRODUCT, notarial_fee: null }).carried, []);
});

test("an untouched application sends what the server would have added itself", () => {
  const deductions = sent(productDeductionFields(PRODUCT));
  assert.deepEqual(deductions, serverAutoAdd(PRODUCT));
});

test("an untouched whole-number product saves as it always has", () => {
  const product = { processing_fee: "2.0000", service_fee: "1.0000", notarial_fee: "0.0000" };
  assert.deepEqual(sent(productDeductionFields(product), product), serverAutoAdd(product));
});

test("the operator's rates and other deductions are sent, not dropped", () => {
  const deductions = sent({
    ...productDeductionFields(PRODUCT),
    processingFeeRate: "1.75",
    otherDeductions: [{ name: "Membership Fee", amount: "250.50" }],
  });
  assert.deepEqual(deductions, [
    { name: "Processing Fee", amount: 1.75, type: "percentage" },
    { name: "Service Fee", amount: 2.5, type: "percentage" },
    { name: "Notarial Fee", amount: 1, type: "percentage" },
    { name: "Membership Fee", amount: 250.5, type: "fixed" },
  ]);
});

test("waiving every fee sends an empty list, which POST /loans takes as none", () => {
  const deductions = sent({
    processingFeeRate: "0",
    serviceFeeRate: "0",
    otherDeductions: [],
    carried: [],
  });
  assert.deepEqual(deductions, []);
});

test("a product that charges nothing sends nothing, as the server would add nothing", () => {
  const product = { processing_fee: "0.0000", service_fee: "0.0000", notarial_fee: "0.0000" };
  assert.deepEqual(sent(productDeductionFields(product), product), []);
});

// ── Editing a saved application ────────────────────────────────────────────

test("a saved loan reloads its own rates, not the product's", () => {
  const items = stored(
    [
      { name: "Processing Fee", amount: 1.75, type: "percentage" },
      { name: "Service Fee", amount: 2.25, type: "percentage" },
      { name: "Notarial Fee", amount: 1, type: "percentage" },
      { name: "Membership Fee", amount: 250.5, type: "fixed" },
    ],
    [175, 225, 100, 250.5],
  );
  assert.deepEqual(storedDeductionFields(items), {
    processingFeeRate: "1.75",
    serviceFeeRate: "2.25",
    otherDeductions: [{ name: "Membership Fee", amount: "250.5" }],
    carried: [{ name: "Notarial Fee", amount: 1, type: "percentage" }],
  });
});

test("a saved loan saved again unchanged sends back exactly what it holds", () => {
  const original: LoanDeduction[] = [
    { name: "Processing Fee", amount: 1.125, type: "percentage" },
    { name: "Service Fee", amount: 2.5, type: "percentage" },
    { name: "Notarial Fee", amount: 1, type: "percentage" },
    { name: "Membership Fee", amount: 250.5, type: "fixed" },
  ];
  const fields = storedDeductionFields(stored(original, [112.5, 250, 100, 250.5]));
  assert.ok(fields);
  assert.deepEqual(sent(fields), original);
});

test("the rate comes from original_value, not the pesos in amount", () => {
  const fields = storedDeductionFields([
    { name: "Processing Fee", amount: 150, type: "percentage", original_value: "1.5000" as unknown as number },
  ]);
  assert.equal(fields?.processingFeeRate, "1.5");
});

test("a fee missing from a saved loan stays at 0%, not the product's rate", () => {
  const fields = storedDeductionFields(
    stored([{ name: "Service Fee", amount: 2.5, type: "percentage" }], [250]),
  );
  assert.ok(fields);
  assert.equal(fields.processingFeeRate, "0");
  assert.equal(feePercent(fields.processingFeeRate, PRODUCT.processing_fee), 0);
  assert.deepEqual(fields.carried, []);
});

test("a fixed Processing Fee (an imported loan) stays a fixed peso deduction", () => {
  const fields = storedDeductionFields([
    { name: "Processing Fee", amount: 300, type: "fixed", original_value: 300 },
  ]);
  assert.deepEqual(fields?.otherDeductions, [{ name: "Processing Fee", amount: "300" }]);
  assert.equal(fields?.processingFeeRate, "0");
});

test("a loan with nothing stored falls back to the product", () => {
  assert.equal(storedDeductionFields([]), null);
  assert.equal(storedDeductionFields(null), null);
  assert.equal(storedDeductionFields(undefined), null);
});

// ── feePercent ─────────────────────────────────────────────────────────────

test("a blank fee field stands for the product's rate; 0 waives it", () => {
  assert.equal(feePercent("", "2.5000"), 2.5);
  assert.equal(feePercent("  ", 1.75), 1.75);
  assert.equal(feePercent("0", "2.5000"), 0);
  assert.equal(feePercent("1.75", "2.5000"), 1.75);
  assert.equal(feePercent(".", "2.5000"), 0);
  assert.equal(feePercent("", null), 0);
});

// ── storedDeductionInputs ──────────────────────────────────────────────────

test("a saved loan's deductions read back as the inputs they were stated with", () => {
  // As LoanService::deductionInputsFrom(): the rate or the pesos from
  // original_value, never the peso amount a percentage came to.
  assert.deepEqual(
    storedDeductionInputs([
      { name: "Processing Fee", amount: 175, type: "percentage", original_value: 1.75 },
      { name: "Membership Fee", amount: 250.5, type: "fixed", original_value: 250.5 },
    ]),
    [
      { name: "Processing Fee", amount: 1.75, type: "percentage" },
      { name: "Membership Fee", amount: 250.5, type: "fixed" },
    ],
  );
});

test("the API's padded strings are read as numbers", () => {
  assert.deepEqual(
    storedDeductionInputs([
      { name: "Service Fee", amount: 250, type: "percentage", original_value: "2.5000" as unknown as number },
    ]),
    [{ name: "Service Fee", amount: 2.5, type: "percentage" }],
  );
});

test("an item with no original_value falls back to its amount, as deductionInputsFrom does", () => {
  // `$item['original_value'] ?? $item['amount']`: null and absent alike.
  assert.deepEqual(
    storedDeductionInputs([
      { name: "Processing Fee", amount: 1.5, type: "percentage", original_value: null as unknown as number },
      { name: "Service Fee", amount: 2.25, type: "percentage" } as StoredDeduction,
      { name: "Membership Fee", amount: 250.5, type: "fixed", original_value: null as unknown as number },
      { name: "Notarial Fee", amount: 300, type: "fixed" } as StoredDeduction,
    ]),
    [
      { name: "Processing Fee", amount: 1.5, type: "percentage" },
      { name: "Service Fee", amount: 2.25, type: "percentage" },
      { name: "Membership Fee", amount: 250.5, type: "fixed" },
      { name: "Notarial Fee", amount: 300, type: "fixed" },
    ],
  );
});

test("a saved loan with no deductions states none", () => {
  assert.deepEqual(storedDeductionInputs([]), []);
  assert.deepEqual(storedDeductionInputs(null), []);
  assert.deepEqual(storedDeductionInputs(undefined), []);
});
