import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isTooPrecise, parseMoneyInput } from "./money-input";

describe("parseMoneyInput", () => {
  test("reads plain pesos exactly, to the centavo, with a two-decimal string to send", () => {
    assert.deepEqual(parseMoneyInput("1500"), { ok: true, amount: 1500, value: "1500.00" });
    assert.deepEqual(parseMoneyInput(" 10.55 "), { ok: true, amount: 10.55, value: "10.55" });
    assert.deepEqual(parseMoneyInput("10.5"), { ok: true, amount: 10.5, value: "10.50" });
    assert.deepEqual(parseMoneyInput("1500.550"), { ok: true, amount: 1500.55, value: "1500.55" });
    assert.deepEqual(parseMoneyInput("007.10"), { ok: true, amount: 7.1, value: "7.10" });
  });

  test("keeps large amounts exact as text, without float arithmetic", () => {
    const r = parseMoneyInput("123456789012.34");
    assert.equal(r.ok, true);
    assert.equal((r as { value: string }).value, "123456789012.34");
  });

  test("refuses more than two decimals instead of rounding", () => {
    const r = parseMoneyInput("10.555", { label: "Deposit amount" });
    assert.deepEqual(r, {
      ok: false,
      message: "Deposit amount can't have more than two decimals (centavos).",
    });
  });

  test("refuses blank, zero, negative and formatted input, in ₱ words", () => {
    for (const raw of ["", "  ", "0", "0.00", "-5", "1,500", "1e3", "abc", "₱100", "1.2.3"]) {
      const r = parseMoneyInput(raw);
      assert.equal(r.ok, false, raw);
      assert.equal((r as { message: string }).message, "Amount must be more than ₱0.00", raw);
    }
  });

  test("allowZero accepts 0 but still refuses blank and negatives", () => {
    assert.deepEqual(parseMoneyInput("0", { allowZero: true }), { ok: true, amount: 0, value: "0.00" });
    assert.deepEqual(parseMoneyInput("", { allowZero: true, label: "Initial deposit" }), {
      ok: false,
      message: "Initial deposit must be ₱0.00 or more",
    });
    assert.equal(parseMoneyInput("-1", { allowZero: true }).ok, false);
  });
});

describe("isTooPrecise", () => {
  test("counts only significant decimals beyond the centavo", () => {
    assert.equal(isTooPrecise("1500.555"), true);
    assert.equal(isTooPrecise("1500.550"), false);
    assert.equal(isTooPrecise("1500"), false);
    assert.equal(isTooPrecise("abc"), false);
  });
});
