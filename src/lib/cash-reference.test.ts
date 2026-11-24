import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  CASH_REFERENCE_PATTERN,
  TIME_DEPOSIT_CASH_SERIES,
  cashAutoReference,
  savedReferencesText,
  seriesAutoReference,
} from "./cash-reference";

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

describe("a cash time deposit placement's automatic reference number", () => {
  test("cash shows the server's next TD number, read-only", () => {
    const field = seriesAutoReference(TIME_DEPOSIT_CASH_SERIES, true, "cash", "TD-0012-2026-0006");
    assert.equal(field?.value, "TD-0012-2026-0006");
    assert.match(field?.hint ?? "", /next TD reference number\. It is confirmed when the placement saves/);
  });

  test("with no preview, or a number from another series, the field locks empty", () => {
    const empty = seriesAutoReference(TIME_DEPOSIT_CASH_SERIES, true, "cash", null);
    assert.equal(empty?.value, "");
    assert.match(empty?.hint ?? "", /Cash placements get the next TD reference number when saved/);
    assert.equal(seriesAutoReference(TIME_DEPOSIT_CASH_SERIES, true, "cash", "CSH-1-2026-0001")?.value, "");
  });

  test("other methods, paying from savings, and a build without the feature keep the typed field", () => {
    for (const method of ["gcash", "maya", "bank_transfer", "savings"]) {
      assert.equal(seriesAutoReference(TIME_DEPOSIT_CASH_SERIES, true, method, "TD-1-2026-0001"), null);
    }
    assert.equal(seriesAutoReference(TIME_DEPOSIT_CASH_SERIES, false, "cash", "TD-1-2026-0001"), null);
  });
});

describe("a bulk batch of cash entries", () => {
  test("each entry gets its own number, starting with the preview", () => {
    const field = cashAutoReference(true, "cash", "CSH-0001-2026-0004", 3);
    assert.equal(field?.value, "CSH-0001-2026-0004");
    assert.equal(field?.hint, "Each entry gets its own CSH reference number when saved, starting with this one.");
  });

  test("with no preview yet it still says each entry is numbered on save", () => {
    assert.equal(
      cashAutoReference(true, "cash", null, 2)?.hint,
      "Each cash entry gets its own CSH reference number when saved.",
    );
  });

  test("one selected row reads as a single entry", () => {
    assert.match(cashAutoReference(true, "cash", "CSH-0001-2026-0004", 1)?.hint ?? "", /confirmed when the entry saves/);
  });

  test("other methods keep the typed field whatever the batch size", () => {
    assert.equal(cashAutoReference(true, "gcash", "CSH-0001-2026-0004", 3), null);
  });
});

describe("the numbers a save got back, for its success message", () => {
  test("a batch reads as its first and last number", () => {
    assert.equal(
      savedReferencesText(["CSH-0001-2026-0004", "CSH-0001-2026-0005", "CSH-0001-2026-0006"]),
      "CSH-0001-2026-0004 to CSH-0001-2026-0006",
    );
  });

  test("one number reads as itself, and none as nothing", () => {
    assert.equal(savedReferencesText(["CSH-0001-2026-0004"]), "CSH-0001-2026-0004");
    assert.equal(savedReferencesText([]), "");
    assert.equal(savedReferencesText([null, undefined, ""]), "");
  });
});
