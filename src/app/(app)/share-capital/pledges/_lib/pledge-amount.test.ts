/**
 * Share Capital Pledges: the amounts typed on the pledge edit, the manual
 * entry and the bulk entries.
 *
 * The page used to round every one of them to whole pesos before saving, so
 * a ₱1,500.55 pledge was stored as ₱1,501.00 and a ₱0.40 entry was dropped.
 *
 * WHAT THIS PROVES: the typed figure is sent exactly, to the centavo; more
 * than two decimals is refused with a message rather than rounded; zero,
 * blank and negative are refused as before; bulk rows left blank are skipped
 * and a bad row names its member.
 * WHAT IT DOES NOT PROVE: the server's own two-decimal check (a 422 on
 * `amount`), which the page shows through `notifyError`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { bulkEntryAmounts, parsePledgeAmount } from "./pledge-amount";

describe("parsePledgeAmount", () => {
  test("keeps centavos exactly", () => {
    assert.deepEqual(parsePledgeAmount("1500.55"), { ok: true, amount: 1500.55 });
    assert.deepEqual(parsePledgeAmount("1500.5"), { ok: true, amount: 1500.5 });
    assert.deepEqual(parsePledgeAmount("1500"), { ok: true, amount: 1500 });
    assert.deepEqual(parsePledgeAmount(" 0.40 "), { ok: true, amount: 0.4 });
  });

  test("trailing zeros past the centavo are not extra precision", () => {
    assert.deepEqual(parsePledgeAmount("1500.550"), { ok: true, amount: 1500.55 });
  });

  test("refuses more than two decimals instead of rounding", () => {
    const parsed = parsePledgeAmount("1500.555");
    assert.equal(parsed.ok, false);
    assert.match(!parsed.ok ? parsed.message : "", /two decimals/);
  });

  test("refuses zero, blank, negative and text with the caller's label", () => {
    for (const raw of ["0", "0.00", "", "   ", "-5", "abc", "1e3"]) {
      assert.deepEqual(
        parsePledgeAmount(raw, "Pledge amount"),
        { ok: false, message: "Pledge amount must be greater than 0" },
        raw
      );
    }
  });
});

describe("bulkEntryAmounts", () => {
  test("sends each typed amount exactly and skips rows left blank", () => {
    const result = bulkEntryAmounts([
      [1, { name: "Ana Cruz", amount: "1500.55" }],
      [2, { name: "Ben Reyes", amount: "" }],
      [3, { name: "Carla Diaz", amount: "0.40" }],
    ]);
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.ok ? [...result.amounts] : [],
      [
        [1, 1500.55],
        [3, 0.4],
      ]
    );
  });

  test("refuses the batch when a row has more than two decimals, naming the member", () => {
    const result = bulkEntryAmounts([
      [1, { name: "Ana Cruz", amount: "100" }],
      [2, { name: "Ben Reyes", amount: "100.555" }],
    ]);
    assert.equal(result.ok, false);
    const message = result.ok ? "" : result.message;
    assert.match(message, /Ben Reyes/);
    assert.match(message, /two decimals/);
  });

  test("asks for an amount when no row has one", () => {
    assert.deepEqual(
      bulkEntryAmounts([
        [1, { name: "Ana Cruz", amount: "" }],
        [2, { name: "Ben Reyes", amount: "0" }],
      ]),
      { ok: false, message: "Enter an amount for at least one member" }
    );
  });
});
