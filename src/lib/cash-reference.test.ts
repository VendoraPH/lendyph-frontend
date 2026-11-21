import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { CASH_REFERENCE_PATTERN, cashAutoReference } from "./cash-reference";

describe("a cash entry's automatic reference number", () => {
  test("cash shows the server's next CSH number, read-only", () => {
    const field = cashAutoReference(true, "cash", "CSH-1002325-2026-0006");
    assert.equal(field?.value, "CSH-1002325-2026-0006");
    assert.match(field?.hint ?? "", /confirmed when the entry saves/);
  });

  test("without a preview the field still locks and says the number comes on save", () => {
    const field = cashAutoReference(true, "cash", null);
    assert.equal(field?.value, "");
    assert.match(field?.hint ?? "", /when saved/);
  });

  test("anything that isn't a CSH number is not shown", () => {
    assert.equal(cashAutoReference(true, "cash", "SC-20261121-000001")?.value, "");
    assert.equal(cashAutoReference(true, "cash", "")?.value, "");
  });

  test("other methods keep the typed field", () => {
    for (const method of ["gcash", "maya", "bank_transfer", "online"] as const) {
      assert.equal(cashAutoReference(true, method, "CSH-1-2026-0001"), null);
    }
  });

  test("a build without the feature keeps today's optional cash field", () => {
    assert.equal(cashAutoReference(false, "cash", "CSH-1-2026-0001"), null);
  });

  test("the format: CSH, the admin id, the year and a 4-digit (or longer) sequence", () => {
    assert.match("CSH-1002325-2026-0001", CASH_REFERENCE_PATTERN);
    assert.match("CSH-7-2027-10000", CASH_REFERENCE_PATTERN);
    assert.doesNotMatch("CSH-1002325-26-0001", CASH_REFERENCE_PATTERN);
    assert.doesNotMatch("CSH-1002325-2026-001", CASH_REFERENCE_PATTERN);
  });
});
