import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsProduct } from "@/types";
import { readCreateDraft, readUpdateDraft, toDraft } from "./product-draft";

const td = () => ({
  ...toDraft(null, "time_deposit"),
  code: "TD",
  name: "Time Deposit",
  rate: "3.2500",
  preProductId: "4",
  terms: "180, 90, 90",
  minOpening: "10000",
});

test("a time deposit draft saves its terms sorted, its first rate as typed and its passbook fields as ₱0.00", () => {
  const { input, problems } = readCreateDraft(td());
  assert.deepEqual(problems, []);
  assert.deepEqual(input.term_options_days, [90, 180]);
  assert.equal(input.annual_interest_rate, "3.2500");
  assert.equal(input.pretermination_product_id, 4);
  assert.equal(input.minimum_opening_balance, "10000.00");
  assert.equal(input.maintaining_balance, "0.00");
  assert.equal(input.minimum_adb_for_interest, "0.00");
  assert.equal(input.kind, "time_deposit");
});

test("a time deposit with no terms, a rate that isn't one, or money with more than two decimals is named", () => {
  const { problems } = readCreateDraft({ ...td(), terms: "", rate: "four", minOpening: "10.555" });
  assert.ok(problems.some((p) => p.startsWith("Terms offered")));
  assert.ok(problems.some((p) => p.startsWith("Interest rate")));
  assert.ok(problems.includes("Minimum placement"));
});

test("a regular draft sends no time deposit fields, and money as two-decimal text", () => {
  const { input } = readCreateDraft({ ...toDraft(null), code: "RS", name: "Regular", rate: "1.5", maintaining: "100" });
  assert.equal(input.kind, "regular");
  assert.equal(input.term_options_days, null);
  assert.equal(input.pretermination_product_id, null);
  assert.equal(input.maintaining_balance, "100.00");
  assert.equal(input.minimum_opening_balance, "0.00");
});

test("a new product starts off; an update sends no rate and no kind", () => {
  assert.equal(toDraft(null).active, false);
  const product = {
    id: 1, code: "RS", name: "Regular", kind: "regular", interest_crediting: "monthly",
    minimum_opening_balance: "500.00", maintaining_balance: "100.00", minimum_adb_for_interest: "1000.00",
    term_options_days: null, pretermination_product_id: null, is_active: true, current_rates: [],
    account_count: 0, can_delete: true,
  } as SavingsProduct;
  const { input, problems } = readUpdateDraft(toDraft(product));
  assert.deepEqual(problems, []);
  assert.equal("annual_interest_rate" in input, false);
  assert.equal("kind" in input, false);
  assert.equal(input.minimum_opening_balance, "500.00");
  assert.equal(input.interest_crediting, "monthly");
});
