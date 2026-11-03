import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseMoneyInput } from "./money-input";

describe("parseMoneyInput", () => {
  test("reads plain pesos exactly, to the centavo", () => {
    assert.deepEqual(parseMoneyInput("1500"), { ok: true, amount: 1500 });
    assert.deepEqual(parseMoneyInput(" 10.55 "), { ok: true, amount: 10.55 });
    assert.deepEqual(parseMoneyInput("1500.550"), { ok: true, amount: 1500.55 });
  });

  test("refuses more than two decimals instead of rounding", () => {
    const r = parseMoneyInput("10.555", { label: "Deposit amount" });
    assert.equal(r.ok, false);
    assert.match((r as { message: string }).message, /Deposit amount can't have more than two decimals/);
  });

  test("refuses blank, zero, negative and formatted input", () => {
    for (const raw of ["", "0", "0.00", "-5", "1,500", "1e3", "abc"]) {
      assert.equal(parseMoneyInput(raw).ok, false, raw);
    }
  });

  test("allowZero accepts 0 but still refuses blank and negatives", () => {
    assert.deepEqual(parseMoneyInput("0", { allowZero: true }), { ok: true, amount: 0 });
    assert.equal(parseMoneyInput("", { allowZero: true }).ok, false);
    assert.equal(parseMoneyInput("-1", { allowZero: true }).ok, false);
  });
});
