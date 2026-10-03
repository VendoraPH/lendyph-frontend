import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrencyExact } from "@/lib/format";
import { cashOutTotalIssue } from "./cash-out-total";

describe("cashOutTotalIssue", () => {
  test("a total of zero is refused, as the server refuses it", () => {
    assert.equal(cashOutTotalIssue(15, 0), `Amount must be more than the ${formatCurrencyExact(15)} charge.`);
  });

  test("a negative total is refused", () => {
    assert.equal(cashOutTotalIssue(15, -5), `Amount must be more than the ${formatCurrencyExact(15)} charge.`);
  });

  test("the message says more than, not at least", () => {
    assert.match(cashOutTotalIssue(15, 0) ?? "", /^Amount must be more than the /);
  });

  test("the charge is shown to the centavo, never rounded", () => {
    assert.equal(cashOutTotalIssue(15.5, 0), "Amount must be more than the ₱15.50 charge.");
  });

  test("a positive total is allowed", () => {
    assert.equal(cashOutTotalIssue(15, 0.01), null);
    assert.equal(cashOutTotalIssue(15, 985), null);
  });

  test("no charge or total yet is left to the tier notice", () => {
    assert.equal(cashOutTotalIssue(null, null), null);
    assert.equal(cashOutTotalIssue(15, null), null);
  });
});
