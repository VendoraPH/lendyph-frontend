import { test } from "node:test";
import assert from "node:assert/strict";
import { readDraft, toDraft } from "./product-draft";

const td = () => ({
  ...toDraft(null, "time_deposit"),
  code: "TD90",
  name: "Time Deposit 90 days",
  rate: "4",
  preRate: "1",
  terms: "180, 90, 90",
  minOpening: "10000",
  withholding: "20",
});

test("a time deposit draft saves its terms sorted and its passbook fields zeroed", () => {
  const { input, problems } = readDraft(td());
  assert.deepEqual(problems, []);
  assert.deepEqual(input.term_options_days, [90, 180]);
  assert.equal(input.pretermination_rate, 1);
  assert.equal(input.maintaining_balance, 0);
  assert.equal(input.dormant_after_days, null);
  assert.equal(input.withholding_tax_rate, 20);
});

test("a time deposit with no terms, or a typed non-number, is named", () => {
  const { problems } = readDraft({ ...td(), terms: "", rate: "four" });
  assert.ok(problems.some((p) => p.startsWith("Terms offered")));
  assert.ok(problems.some((p) => p.startsWith("Interest rate")));
});

test("a regular draft sends no time deposit fields", () => {
  const { input } = readDraft({ ...toDraft(null), code: "RS", name: "Regular", rate: "2" });
  assert.equal(input.kind, "regular");
  assert.equal(input.term_options_days, null);
  assert.equal(input.pretermination_rate, null);
});
