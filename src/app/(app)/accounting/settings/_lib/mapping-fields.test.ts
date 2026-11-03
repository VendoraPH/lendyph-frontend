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
