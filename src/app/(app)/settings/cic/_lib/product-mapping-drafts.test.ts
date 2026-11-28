import assert from "node:assert/strict";
import { test } from "node:test";

import type { CicProductMappingValue, CicProductMappings } from "@/types/cic";
import { draftsOf, mergeClearedRow, sameDraft } from "./product-mapping-drafts";

const mapping = (contract_type: string): CicProductMappingValue => ({
  record_type: "CI",
  contract_type,
  contract_type_label: null,
  transaction_type: "NL",
  transaction_type_label: null,
  purpose_code: null,
  purpose_label: null,
  updated_by: null,
  updated_at: null,
});

const listing = (rows: [number, CicProductMappingValue | null][]): CicProductMappings => ({
  products: rows.map(([id, m]) => ({ loan_product: { id, name: `Product ${id}`, status: "active" }, mapping: m })),
  code_lists: { "CI:ContractTypeDomain": [], "CN:ContractTypeDomain": [], TransactionTypeDomain: [], CreditPurposeDomain: [] },
});

test("clearing one product keeps the unsaved edits on the other rows", () => {
  const before = listing([[1, mapping("10")], [2, mapping("10")], [3, null]]);
  const edited = draftsOf(before).map((r) =>
    r.loan_product_id === 2 ? { ...r, contract_type: "20" } : r.loan_product_id === 3 ? { ...r, record_type: "CN" as const } : r,
  );
  const after = listing([[1, null], [2, mapping("10")], [3, null]]);
  const merged = mergeClearedRow(edited, after, 1);

  assert.equal(merged.find((r) => r.loan_product_id === 1)?.record_type, null);
  assert.equal(merged.find((r) => r.loan_product_id === 2)?.contract_type, "20");
  assert.equal(merged.find((r) => r.loan_product_id === 3)?.record_type, "CN");
});

test("the cleared row is taken from the server even when it was being edited", () => {
  const edited = draftsOf(listing([[1, mapping("10")]])).map((r) => ({ ...r, contract_type: "20" }));
  const merged = mergeClearedRow(edited, listing([[1, null]]), 1);
  assert.deepEqual(merged[0], { ...edited[0], record_type: null, contract_type: null, transaction_type: null, purpose_code: null });
});

test("the listing decides which products are shown", () => {
  const edited = draftsOf(listing([[1, mapping("10")], [2, null]]));
  const merged = mergeClearedRow(edited, listing([[1, null], [4, null]]), 1);
  assert.deepEqual(merged.map((r) => r.loan_product_id), [1, 4]);
});

test("a row is unchanged only when every code matches", () => {
  const [a] = draftsOf(listing([[1, mapping("10")]]));
  assert.equal(sameDraft(a, { ...a }), true);
  assert.equal(sameDraft(a, { ...a, purpose_code: "1" }), false);
  assert.equal(sameDraft(a, undefined), false);
});
