import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_PRODUCTS, productFilterOptions, productIdParam } from "./product-filter";

const PRODUCTS = [
  { id: 3, name: "Youth Savings", kind: "regular" as const, is_active: false },
  { id: 1, name: "Regular Savings", kind: "regular" as const, is_active: true },
  { id: 2, name: "90-day Time Deposit", kind: "time_deposit" as const, is_active: true },
];

test("every product, active first, each saying its kind in words", () => {
  assert.deepEqual(productFilterOptions(PRODUCTS), [
    { value: ALL_PRODUCTS, label: "All products" },
    { value: "2", label: "90-day Time Deposit (Time deposit)" },
    { value: "1", label: "Regular Savings (Regular savings)" },
    { value: "3", label: "Youth Savings (Regular savings) · off" },
  ]);
});

test("a kind lists only its own products", () => {
  assert.deepEqual(
    productFilterOptions(PRODUCTS, "time_deposit").map((o) => o.label),
    ["All products", "90-day Time Deposit"],
  );
  assert.deepEqual(productFilterOptions(null).length, 1);
});

test("the request sends a product id only when one is picked", () => {
  assert.equal(productIdParam(ALL_PRODUCTS), undefined);
  assert.equal(productIdParam("7"), 7);
  assert.equal(productIdParam("x"), undefined);
});
