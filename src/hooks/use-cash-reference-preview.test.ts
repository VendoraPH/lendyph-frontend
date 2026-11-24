import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { shownCashPreview } from "./use-cash-reference-preview";

const loaded = { key: 2, date: "2026-12-31", value: "TD-0001-2026-0007" };

describe("which cash reference preview the field shows", () => {
  test("the one fetched for this save count and this date", () => {
    assert.equal(shownCashPreview(loaded, true, 2, "2026-12-31"), "TD-0001-2026-0007");
  });

  test("none while the next one loads after the date changed", () => {
    assert.equal(shownCashPreview(loaded, true, 2, "2027-01-01"), null);
    assert.equal(shownCashPreview(loaded, true, 2, null), null);
  });

  test("none after a save moved the series on, or while the form isn't on cash", () => {
    assert.equal(shownCashPreview(loaded, true, 3, "2026-12-31"), null);
    assert.equal(shownCashPreview(loaded, false, 2, "2026-12-31"), null);
    assert.equal(shownCashPreview(null, true, 2, "2026-12-31"), null);
  });

  test("a preview fetched for no date is today's, shown while the form has none", () => {
    assert.equal(shownCashPreview({ key: 0, date: null, value: "CSH-0001-2026-0003" }, true, 0, null), "CSH-0001-2026-0003");
  });
});
