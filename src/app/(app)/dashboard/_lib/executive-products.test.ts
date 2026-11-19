import test from "node:test";
import assert from "node:assert/strict";

import { productRows, productShareSlices } from "./executive-sections";
import type { PortfolioByProductReport } from "@/types/dashboard-reports";

const report: PortfolioByProductReport = {
  products: [
    { product_id: 1, product_name: "Salary", loan_count: 4, total_outstanding: 70000, outstanding_principal: 60000, outstanding_share: 28.57, par_ratio: 2 },
    { product_id: 2, product_name: "Business", loan_count: 2, total_outstanding: 90000, outstanding_principal: 80000, outstanding_share: 38.1, par_ratio: 0 },
    { product_id: 3, product_name: "Emergency", loan_count: 1, total_outstanding: 0, outstanding_principal: 0, outstanding_share: 0, par_ratio: 0 },
  ],
  named_product_ids: [2, 1],
  // Deliberately not 100 minus the named shares: the slice is the server's.
  other: { product_count: 3, product_ids: [4, 5, 6], loan_count: 5, outstanding_principal: 70000, total_outstanding: 75000, outstanding_share: 33.3 },
};

test("the share chart names the server's named products, in its order, by outstanding_share", () => {
  assert.deepEqual(
    productShareSlices(report).map((s) => [s.name, s.share]),
    [
      ["Business", 38.1],
      ["Salary", 28.57],
      ["3 other products", 33.3],
    ],
  );
});

test("an empty other row draws no Other slice", () => {
  const slices = productShareSlices({ ...report, other: { ...report.other!, product_count: 0, outstanding_share: 0 } });
  assert.equal(slices.some((s) => s.other), false);
});

test("nothing owed draws no slices", () => {
  assert.deepEqual(productShareSlices({ products: [], named_product_ids: [], other: null }), []);
});

test("product rows read the share of the outstanding book, never the share of released or the deprecated alias", () => {
  const rows = productRows(report);
  assert.equal(rows[0].name, "Business");
  assert.equal(rows[0].share, 38.1);
  assert.equal(rows[0].principal, 80000);
  assert.equal(rows[0].outstanding, 90000);
});
