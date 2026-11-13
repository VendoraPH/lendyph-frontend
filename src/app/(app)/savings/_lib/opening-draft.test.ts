import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsOpeningCheck } from "@/types";
import {
  EMPTY_OPENING_DETAILS,
  heldProductIds,
  memberCheckEligibilityNote,
  memberCheckRows,
  openingProductOptions,
  readOpeningDetails,
  SOURCE_OF_FUNDS_OPTIONS,
} from "./opening-draft";

test("no opening details sends nothing extra", () => {
  const { input, problems } = readOpeningDetails(EMPTY_OPENING_DETAILS);
  assert.deepEqual(problems, []);
  assert.deepEqual(input, {});
});

test("the officer, the source of funds and the beneficiary are sent trimmed, blank parts left out", () => {
  const { input, problems } = readOpeningDetails({
    officer: { id: 9, full_name: "Ana Cruz" },
    source: "salary",
    sourceOther: "ignored unless other",
    beneficiaryName: "  Maria Santos ",
    beneficiaryRelationship: "Mother",
    beneficiaryContact: " ",
  });
  assert.deepEqual(problems, []);
  assert.deepEqual(input, {
    account_officer_id: 9,
    source_of_funds: "salary",
    beneficiary: { name: "Maria Santos", relationship: "Mother" },
  });
});

test("'Other' needs the member's own words, which go as source_of_funds_other", () => {
  assert.deepEqual(readOpeningDetails({ ...EMPTY_OPENING_DETAILS, source: "other", sourceOther: " " }).problems, [
    "Source of funds: say where the money comes from",
  ]);
  const { input } = readOpeningDetails({ ...EMPTY_OPENING_DETAILS, source: "other", sourceOther: " Rental income " });
  assert.deepEqual(input, { source_of_funds: "other", source_of_funds_other: "Rental income" });
});

test("every source of funds the server takes is offered in words", () => {
  assert.deepEqual(
    SOURCE_OF_FUNDS_OPTIONS.map((o) => o.value),
    ["salary", "business", "remittance", "pension", "savings", "other"],
  );
  assert.ok(SOURCE_OF_FUNDS_OPTIONS.every((o) => /^[A-Z]/.test(o.label)));
});

const CHECK: SavingsOpeningCheck = {
  member: {
    id: 4, name: "Juan Dela Cruz", borrower_code: "M-0004", membership_number: null, status: "active",
    branch_id: 1, branch_name: "Main Branch", membership_date: "2025-03-15", member_type: "associate",
  },
  loans: { collectible_count: 2, total_outstanding: "15250.50" },
  share_capital_balance: "3000.00",
  savings_accounts: [],
  eligible_products: [
    { id: 3, code: "RS", name: "Regular Savings", minimum_opening_balance: "500.00", maintaining_balance: "100.00" },
  ],
};

test("the member check reads the server's figures in words", () => {
  const rows = Object.fromEntries(memberCheckRows(CHECK).map((r) => [r.label, r.value]));
  assert.equal(rows["Status"], "Active");
  assert.equal(rows["Branch"], "Main Branch");
  assert.equal(rows["Member since"], "Mar 15, 2025");
  assert.equal(rows["Member type"], "Associate member");
  assert.equal(rows["Active loans"], "2");
  assert.equal(rows["Loans outstanding"], "₱15,250.50");
  assert.equal(rows["Share capital"], "₱3,000.00");
});

test("a figure the server didn't send reads a dash, never ₱0.00 or 0", () => {
  const rows = memberCheckRows({
    ...CHECK,
    member: { ...CHECK.member, status: null, branch_name: null, membership_date: null, member_type: null },
    loans: { collectible_count: null, total_outstanding: null },
    share_capital_balance: null,
  });
  for (const row of rows) assert.equal(row.value, "—", row.label);
});

test("a zero from the server stays ₱0.00 and 0; withdrawn and deceased read in words", () => {
  const rows = Object.fromEntries(
    memberCheckRows({
      ...CHECK,
      member: { ...CHECK.member, status: "withdrawn" },
      loans: { collectible_count: 0, total_outstanding: "0.00" },
      share_capital_balance: "0.00",
    }).map((r) => [r.label, r.value]),
  );
  assert.equal(rows["Status"], "Withdrawn");
  assert.equal(rows["Active loans"], "0");
  assert.equal(rows["Loans outstanding"], "₱0.00");
  assert.equal(rows["Share capital"], "₱0.00");
});

test("the product list offers only the products the server says the member may open", () => {
  assert.deepEqual(openingProductOptions(CHECK), [{ value: "3", label: "Regular Savings (RS)" }]);
  assert.deepEqual(openingProductOptions(null), []);
});

// Browser check 5: one clear reason. With no product turned on, the dialog's
// own notice explains it; a member ruled out by the product rules gets the
// dialog's notice too. The member check keeps its sentence only for a member
// who already holds an account in every active product.
const HOLDS_ONE_OF_EACH =
  "The member can't open any more savings products: none is open to them, or they already hold one of each.";
const NONE_OPEN = { eligible_products: [], savings_accounts: [] };
const account = (id: number, productId: number, status: "active" | "dormant" | "frozen" | "closed" = "active") => ({
  id,
  account_number: `SA-${id}`,
  product_id: productId,
  product_name: null,
  product_kind: "regular" as const,
  status,
  balance: "100.00",
});

test("with no savings product at all, the member check adds no sentence", () => {
  assert.equal(memberCheckEligibilityNote(NONE_OPEN, []), null);
  // A time deposit product doesn't count: Open Account opens regular savings.
  assert.equal(memberCheckEligibilityNote(NONE_OPEN, [{ id: 9, kind: "time_deposit", is_active: true }]), null);
});

test("with only inactive savings products, the member check adds no sentence", () => {
  assert.equal(
    memberCheckEligibilityNote(NONE_OPEN, [
      { id: 1, kind: "regular", is_active: false },
      { id: 2, kind: "regular", is_active: false },
    ]),
    null,
  );
});

test("when the member already holds an account in every active product, the member check says so", () => {
  const holds = { eligible_products: [], savings_accounts: [account(10, 1), account(11, 2, "dormant")] };
  assert.equal(
    memberCheckEligibilityNote(holds, [
      { id: 1, kind: "regular", is_active: true },
      { id: 2, kind: "regular", is_active: true },
      { id: 3, kind: "regular", is_active: false },
    ]),
    HOLDS_ONE_OF_EACH,
  );
  assert.deepEqual([...heldProductIds(holds)].sort(), ["1", "2"]);
});

test("a member ruled out by the product rules gets no member-check sentence (the dialog's notice explains it)", () => {
  const active = [
    { id: 1, kind: "regular" as const, is_active: true },
    { id: 2, kind: "regular" as const, is_active: true },
  ];
  // Holds none.
  assert.equal(memberCheckEligibilityNote(NONE_OPEN, active), null);
  // Holds one, ruled out of the other; a closed account doesn't count as held.
  assert.equal(
    memberCheckEligibilityNote({ eligible_products: [], savings_accounts: [account(10, 1), account(12, 2, "closed")] }, active),
    null,
  );
});

test("while the products load the member check says nothing; a member who can open products reads them by name", () => {
  assert.equal(memberCheckEligibilityNote(NONE_OPEN, null), null);
  assert.equal(memberCheckEligibilityNote(CHECK, [{ id: 3, kind: "regular", is_active: true }]), "Can open: Regular Savings.");
});
