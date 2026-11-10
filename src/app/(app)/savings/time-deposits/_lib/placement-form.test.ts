import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPlacement, type PlacementForm } from "./placement-form";

const PRODUCT = { id: 3, term_options_days: [90, 180] };
const FORM: PlacementForm = {
  memberId: 7,
  productId: "3",
  term: "90",
  placementDate: "2026-11-10",
  amount: "25000",
  instruction: "payout",
  method: "cash",
  fundingAccountId: "",
  payoutAccountId: "",
  reference: "",
};

test("a complete form builds the quote request and the body, with the amount as typed text", () => {
  const { errors, quote, body } = checkPlacement(FORM, PRODUCT);
  assert.ok(Object.values(errors).every((e) => e === null));
  assert.deepEqual(quote, { borrower_id: 7, product_id: 3, principal: "25000.00", term_days: 90, placement_date: "2026-11-10" });
  assert.deepEqual(body, {
    borrower_id: 7,
    product_id: 3,
    principal: "25000.00",
    term_days: 90,
    placement_date: "2026-11-10",
    maturity_instruction: "payout",
    payment_method: "cash",
  });
});

test("a term the product doesn't offer, or no amount, gives no quote and no body", () => {
  const badTerm = checkPlacement({ ...FORM, term: "120" }, PRODUCT);
  assert.equal(badTerm.quote, null);
  assert.equal(badTerm.body, null);
  assert.ok(badTerm.errors.term);
  const noAmount = checkPlacement({ ...FORM, amount: "" }, PRODUCT);
  assert.equal(noAmount.quote, null);
  assert.ok(noAmount.errors.amount?.includes("₱0.00"));
});

test("paid from savings, it needs the funding account and sends it", () => {
  const missing = checkPlacement({ ...FORM, method: "savings" }, PRODUCT);
  assert.ok(missing.errors.funding);
  assert.equal(missing.body, null);
  const { body } = checkPlacement({ ...FORM, method: "savings", fundingAccountId: "11", payoutAccountId: "12" }, PRODUCT);
  assert.equal(body?.funding_account_id, 11);
  assert.equal(body?.payout_account_id, 12);
  assert.equal(body?.payment_method, "savings");
});

test("the quote can be asked for before the member is chosen", () => {
  const { quote, body } = checkPlacement({ ...FORM, memberId: null }, PRODUCT);
  assert.equal(quote?.product_id, 3);
  assert.equal("borrower_id" in (quote ?? {}), false);
  assert.equal(body, null);
});
