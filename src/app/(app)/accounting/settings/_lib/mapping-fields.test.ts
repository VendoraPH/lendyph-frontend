import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ACCOUNT_MAPPING_CODES,
  DEFAULT_CHART_OF_ACCOUNTS,
} from "@/constants/chart-of-accounts";
import { GROUPS } from "./mapping-fields";

const FIELDS = GROUPS.flatMap((group) => group.fields);

test("every posting role is offered on the Default Accounts screen exactly once", () => {
  const offered = FIELDS.map((field) => field.key).sort();
  assert.deepEqual(offered, Object.keys(DEFAULT_ACCOUNT_MAPPING_CODES).sort());
});

test("each role's default account is one its field accepts", () => {
  const byCode = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
  for (const field of FIELDS) {
    const seed = byCode.get(DEFAULT_ACCOUNT_MAPPING_CODES[field.key])!;
    assert.ok(field.types.includes(seed.type), `${field.key} defaults to ${seed.code}, a ${seed.type}`);
  }
});

test("the tax roles can be re-pointed, to liability accounts only", () => {
  const taxes = GROUPS.find((group) => group.title === "Taxes withheld at release");
  assert.ok(taxes, "the Taxes group is on the screen");
  assert.deepEqual(
    taxes.fields.map((field) => [field.key, field.types]),
    [
      ["documentary_stamp_tax_payable", ["liability"]],
      ["withholding_tax_payable", ["liability"]],
      ["other_taxes_payable", ["liability"]],
    ]
  );
});

test("the Phase 2 roles can be re-pointed, each to the account type it must be", () => {
  const byKey = new Map(FIELDS.map((field) => [field.key, field]));
  const expected = {
    gcash_service_income: ["income"],
    loan_adjustments: ["asset"],
    unearned_restructure_income: ["asset"],
    net_surplus: ["equity"],
    suspense: ["liability"],
  } as const;
  for (const [key, types] of Object.entries(expected)) {
    const field = byKey.get(key as keyof typeof expected);
    assert.ok(field, `${key} is on the screen`);
    assert.deepEqual(field.types, types, key);
    assert.ok(field.label.trim() && field.hint.trim(), `${key} has a label and a hint`);
  }
});

test("every label and hint reads in plain words: Member, never Borrower, and no dollar sign", () => {
  for (const field of FIELDS) {
    for (const text of [field.label, field.hint]) {
      assert.doesNotMatch(text, /borrower/i, field.key);
      assert.doesNotMatch(text, /\$|USD/, field.key);
      assert.doesNotMatch(text, /_/, field.key);
    }
  }
});
