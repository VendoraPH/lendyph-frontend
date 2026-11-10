import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COOPERATIVE_MAPPING_OVERRIDES,
  DEFAULT_ACCOUNT_MAPPING_CODES,
  templateChart,
} from "@/constants/chart-of-accounts";
import type { Account } from "@/types";
import { GROUPS, accountsForField, saveFailureMessage } from "./mapping-fields";

const FIELDS = GROUPS.flatMap((group) => group.fields);

// A cooperative chart maps every role, the four savings roles included.
const COOPERATIVE_MAPPING: Record<string, string> = { ...DEFAULT_ACCOUNT_MAPPING_CODES, ...COOPERATIVE_MAPPING_OVERRIDES };

test("every posting role is offered on the Default Accounts screen exactly once", () => {
  const offered = FIELDS.map((field) => field.key).sort();
  assert.deepEqual(offered, Object.keys(COOPERATIVE_MAPPING).sort());
});

test("each role's default account on a cooperative chart is one its field accepts", () => {
  const byCode = new Map(templateChart("cooperative").map((a) => [a.code, a]));
  for (const field of FIELDS) {
    const seed = byCode.get(COOPERATIVE_MAPPING[field.key])!;
    assert.ok(field.types.includes(seed.type), `${field.key} defaults to ${seed.code}, a ${seed.type}`);
  }
});

test("the four savings roles read in words, each with the account type it must be", () => {
  const savings = GROUPS.find((group) => group.title === "Savings and time deposits");
  assert.ok(savings, "the savings group is on the screen");
  assert.deepEqual(
    savings.fields.map((field) => [field.key, field.label, field.types]),
    [
      ["savings_deposits", "Savings deposits", ["liability"]],
      ["time_deposits", "Time deposits", ["liability"]],
      ["interest_expense_deposits", "Interest expense on deposits", ["expense"]],
      ["withholding_tax_deposits", "Withholding tax on deposit interest", ["liability"]],
    ],
  );
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

function account(id: number, code: string, type: Account["type"], extra: Partial<Account> = {}): Account {
  return {
    id,
    code,
    name: `Account ${code}`,
    type,
    normal_balance: "credit",
    is_contra: false,
    parent_id: null,
    is_group: false,
    is_active: true,
    ...extra,
  };
}

test("net surplus never offers 3050 Opening Balance Equity, which the server refuses", () => {
  const accounts = [account(1, "3030", "equity"), account(2, "3050", "equity"), account(3, "3060", "equity")];
  const netSurplus = FIELDS.find((field) => field.key === "net_surplus")!;
  assert.deepEqual(accountsForField(netSurplus, accounts).map((a) => a.code), ["3030", "3060"]);
  const shareCapital = FIELDS.find((field) => field.key === "share_capital")!;
  assert.deepEqual(accountsForField(shareCapital, accounts).map((a) => a.code), ["3030", "3050", "3060"]);
});

test("each field still offers only its own types, and money roles only money accounts", () => {
  const accounts = [account(1, "1010", "asset", { cash_kind: "cash" }), account(2, "1100", "asset"), account(3, "4010", "income")];
  const cash = FIELDS.find((field) => field.key === "cash")!;
  assert.deepEqual(accountsForField(cash, accounts).map((a) => a.code), ["1010"]);
  const receivable = FIELDS.find((field) => field.key === "loans_receivable")!;
  assert.deepEqual(accountsForField(receivable, accounts).map((a) => a.code), ["1010", "1100"]);
});

test("a refused save shows the server's own words", () => {
  const words =
    "Retained earnings or net surplus can't post to 3050 Opening Balance Equity, the opening balance equity account: the year's result would be mixed into the opening balances. Choose another equity account.";
  const err = {
    isAxiosError: true,
    response: { status: 422, data: { message: "The given data was invalid.", errors: { net_surplus: [words] } } },
  };
  assert.equal(saveFailureMessage(err), words);
  assert.equal(saveFailureMessage(new Error("boom")), "Could not save these settings.");
});
