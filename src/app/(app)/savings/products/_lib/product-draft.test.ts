import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsProduct } from "@/types";
import { readCreateDraft, readUpdateDraft, toDraft } from "./product-draft";

const td = () => ({
  ...toDraft(null, "time_deposit"),
  code: "TD",
  name: "Time Deposit",
  rate: "3.2500",
  preProductId: "4",
  terms: "180, 90, 90",
  minOpening: "10000",
});

test("a time deposit draft saves its terms sorted, its first rate as typed and its passbook fields as ₱0.00", () => {
  const { input, problems } = readCreateDraft(td());
  assert.deepEqual(problems, []);
  assert.deepEqual(input.term_options_days, [90, 180]);
  assert.equal(input.annual_interest_rate, "3.2500");
  assert.equal(input.pretermination_product_id, 4);
  assert.equal(input.minimum_opening_balance, "10000.00");
  assert.equal(input.maintaining_balance, "0.00");
  assert.equal(input.minimum_adb_for_interest, "0.00");
  assert.equal(input.kind, "time_deposit");
});

test("a time deposit with no terms, a rate that isn't one, or money with more than two decimals is named", () => {
  const { problems } = readCreateDraft({ ...td(), terms: "", rate: "four", minOpening: "10.555" });
  assert.ok(problems.some((p) => p.startsWith("Terms offered")));
  assert.ok(problems.some((p) => p.startsWith("Interest rate")));
  assert.ok(problems.includes("Minimum placement"));
});

test("a regular draft sends no time deposit fields, and money as two-decimal text", () => {
  const { input } = readCreateDraft({ ...toDraft(null), code: "RS", name: "Regular", rate: "1.5", maintaining: "100" });
  assert.equal(input.kind, "regular");
  assert.equal("term_options_days" in input, false);
  assert.equal("pretermination_product_id" in input, false);
  assert.equal(input.maintaining_balance, "100.00");
  assert.equal(input.minimum_opening_balance, "0.00");
});

test("a new product starts off; an update sends no rate and no kind", () => {
  assert.equal(toDraft(null).active, false);
  const product = {
    id: 1, code: "RS", name: "Regular", kind: "regular", interest_crediting: "monthly",
    minimum_opening_balance: "500.00", maintaining_balance: "100.00", minimum_adb_for_interest: "1000.00",
    term_options_days: null, pretermination_product_id: null, is_active: true, current_rates: [],
    account_count: 0, can_delete: true,
  } as SavingsProduct;
  const { input, problems } = readUpdateDraft(toDraft(product));
  assert.deepEqual(problems, []);
  assert.equal("annual_interest_rate" in input, false);
  assert.equal("kind" in input, false);
  assert.equal(input.minimum_opening_balance, "500.00");
  assert.equal(input.interest_crediting, "monthly");
});

const regular = () => ({ ...toDraft(null), code: "RS", name: "Regular", rate: "1.5" });

test("a regular product sends its rules: blank limits as no limit, money as two-decimal text, the switches", () => {
  const { input, problems } = readCreateDraft({
    ...regular(),
    maxBalance: "500000",
    minDeposit: "100",
    maxDeposit: "",
    minWithdrawal: "",
    maxWithdrawal: "20000.5",
    freeWithdrawals: "4",
    excessMode: "fee",
    excessFee: "25",
    allowTransfers: false,
  });
  assert.deepEqual(problems, []);
  assert.equal(input.max_balance, "500000.00");
  assert.equal(input.min_deposit, "100.00");
  assert.equal(input.max_deposit, null);
  assert.equal(input.min_withdrawal, null);
  assert.equal(input.max_withdrawal, "20000.50");
  assert.equal(input.free_withdrawals_per_month, 4);
  assert.equal(input.excess_withdrawal_fee, "25.00");
  assert.equal(input.allow_deposits, true);
  assert.equal(input.allow_withdrawals, true);
  assert.equal(input.allow_transfers, false);
  assert.equal(input.eligible_member_types, null);
  assert.equal(input.eligible_branch_ids, null);
});

test("refusing beyond the free count sends no fee; a ₱0.00 fee is a fee; unlimited withdrawals send neither", () => {
  const refuse = readCreateDraft({ ...regular(), freeWithdrawals: "2", excessMode: "refuse", excessFee: "25" }).input;
  assert.equal(refuse.free_withdrawals_per_month, 2);
  assert.equal(refuse.excess_withdrawal_fee, null);
  const zero = readCreateDraft({ ...regular(), freeWithdrawals: "2", excessMode: "fee", excessFee: "0" }).input;
  assert.equal(zero.excess_withdrawal_fee, "0.00");
  const unlimited = readCreateDraft({ ...regular(), freeWithdrawals: "", excessMode: "fee", excessFee: "25" }).input;
  assert.equal(unlimited.free_withdrawals_per_month, null);
  assert.equal(unlimited.excess_withdrawal_fee, null);
});

test("bad limits, a free count that isn't a whole number and a missing fee are named", () => {
  const { problems } = readCreateDraft({
    ...regular(),
    maxBalance: "1.234",
    freeWithdrawals: "2.5",
    excessMode: "fee",
    excessFee: "",
  });
  assert.ok(problems.includes("Maximum balance"));
  assert.ok(problems.includes("Free withdrawals a month (a whole number, or blank for no limit)"));
  assert.ok(problems.includes("Excess-withdrawal fee"));
});

test("eligibility sends the member types and branch ids picked, none picked meaning everyone", () => {
  const { input } = readCreateDraft({ ...regular(), memberTypes: ["associate", "regular"], branchIds: [7, 3] });
  assert.deepEqual(input.eligible_member_types, ["regular", "associate"]);
  assert.deepEqual(input.eligible_branch_ids, [3, 7]);
});

test("a time deposit product sends only the eligibility rules", () => {
  const { input } = readCreateDraft({ ...td(), maxBalance: "100", freeWithdrawals: "3", memberTypes: ["regular"] });
  for (const key of [
    "max_balance", "min_deposit", "max_deposit", "min_withdrawal", "max_withdrawal",
    "free_withdrawals_per_month", "excess_withdrawal_fee", "allow_deposits", "allow_withdrawals", "allow_transfers",
  ]) {
    assert.equal(key in input, false, key);
  }
  assert.deepEqual(input.eligible_member_types, ["regular"]);
  assert.equal(input.eligible_branch_ids, null);
});

test("an edited product's draft shows its stored rules, and saves them back unchanged", () => {
  const product = {
    id: 2, code: "RS", name: "Regular", kind: "regular", interest_crediting: "quarterly",
    minimum_opening_balance: "500.00", maintaining_balance: "100.00", minimum_adb_for_interest: "0.00",
    term_options_days: null, pretermination_product_id: null, is_active: true, current_rates: [],
    account_count: 0, can_delete: true,
    max_balance: "1000000.00", min_deposit: null, max_deposit: null, min_withdrawal: "100.00", max_withdrawal: null,
    free_withdrawals_per_month: 3, excess_withdrawal_fee: null,
    allow_deposits: true, allow_withdrawals: false, allow_transfers: true,
    eligible_member_types: ["regular"], eligible_branch_ids: [4],
  } as SavingsProduct;
  const draft = toDraft(product);
  assert.equal(draft.maxBalance, "1000000.00");
  assert.equal(draft.minDeposit, "");
  assert.equal(draft.freeWithdrawals, "3");
  assert.equal(draft.excessMode, "refuse");
  assert.equal(draft.allowWithdrawals, false);
  const { input } = readUpdateDraft(draft);
  assert.equal(input.max_balance, "1000000.00");
  assert.equal(input.min_withdrawal, "100.00");
  assert.equal(input.free_withdrawals_per_month, 3);
  assert.equal(input.excess_withdrawal_fee, null);
  assert.equal(input.allow_withdrawals, false);
  assert.deepEqual(input.eligible_member_types, ["regular"]);
  assert.deepEqual(input.eligible_branch_ids, [4]);
});
