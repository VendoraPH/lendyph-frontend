import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyDrain, type DrainResult } from "@/lib/paginate";
import type { LoanProduct } from "@/types";
import { feeProductsRead, feeProductsText } from "./fee-products";

const products = (...rows: { id: number; name: string }[]): DrainResult<LoanProduct> => ({
  rows: rows as LoanProduct[],
  total: rows.length,
  truncated: false,
  pagesFetched: 1,
});

test("without loans:view the products list isn't asked for: an empty one stands in, with no error", async () => {
  let asked = 0;
  const listAll = async () => {
    asked++;
    return products({ id: 1, name: "Salary Loan" });
  };
  assert.deepEqual(await feeProductsRead(false, listAll), emptyDrain());
  assert.equal(asked, 0);
  assert.deepEqual((await feeProductsRead(true, listAll)).rows.map((p) => p.name), ["Salary Loan"]);
  assert.equal(asked, 1);
});

test("a fee's products read by name, or in words where the names can't be read", () => {
  const names = new Map([
    [1, "Salary Loan"],
    [2, "Business Loan"],
    [3, "Emergency Loan"],
  ]);
  assert.equal(feeProductsText([], names), "All products");
  assert.equal(feeProductsText(undefined, names), "All products");
  assert.equal(feeProductsText([1, 2], names), "Salary Loan, Business Loan");
  assert.equal(feeProductsText([1, 2, 3], names), "Salary Loan, Business Loan +1");
  // An id the list didn't hold keeps its place, never read as "All products".
  assert.equal(feeProductsText([9], names), "Product #9");

  // No loan access: the list wasn't read, so no name and no number reads as one.
  assert.equal(feeProductsText([], null), "All products");
  assert.equal(feeProductsText([1], null), "1 product (names need loan access)");
  assert.equal(feeProductsText([1, 2, 3], null), "3 products (names need loan access)");
});
