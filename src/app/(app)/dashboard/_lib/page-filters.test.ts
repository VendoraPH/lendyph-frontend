import test from "node:test";
import assert from "node:assert/strict";

import { NO_PAGE_FILTERS, activeFilterChips, pageFilterIds, withoutFilter } from "./page-filters";

const products = [
  { id: 5, name: "Salary Loan" },
  { id: 6, name: "Business Loan" },
];

test("no filter set: no chips and nothing sent", () => {
  assert.deepEqual(activeFilterChips(NO_PAGE_FILTERS, products), []);
  assert.deepEqual(pageFilterIds(NO_PAGE_FILTERS), {});
});

test("each active filter is a chip in words, and the count is the chips'", () => {
  const choice = { productId: 5, officer: { id: 9, full_name: "Ana Reyes" }, collector: { id: 11, full_name: "Ben Cruz" } };
  assert.deepEqual(activeFilterChips(choice, products), [
    { key: "product", label: "Product: Salary Loan" },
    { key: "officer", label: "Loan officer: Ana Reyes" },
    { key: "collector", label: "Collector: Ben Cruz" },
  ]);
  assert.deepEqual(pageFilterIds(choice), { product_id: 5, officer_id: 9, collector_id: 11 });
});

test("a product not in the list yet still reads as a chip", () => {
  assert.deepEqual(activeFilterChips({ ...NO_PAGE_FILTERS, productId: 42 }, []), [{ key: "product", label: "Product: #42" }]);
});

test("removing a chip clears only that filter", () => {
  const choice = { productId: 5, officer: { id: 9, full_name: "Ana Reyes" }, collector: null };
  assert.deepEqual(withoutFilter(choice, "product"), { productId: undefined, officer: { id: 9, full_name: "Ana Reyes" }, collector: null });
  assert.deepEqual(withoutFilter(choice, "officer"), { productId: 5, officer: null, collector: null });
});
