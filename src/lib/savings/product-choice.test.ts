import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsProductKind } from "@/types";
import { productChoice, termChoice } from "./product-choice";

type P = { id: number; code: string; name: string; kind: SavingsProductKind; is_active: boolean };

const RS: P = { id: 1, code: "RS", name: "Regular Savings", kind: "regular", is_active: true };
const KS: P = { id: 2, code: "KS", name: "Kiddie Savings", kind: "regular", is_active: false };
const TD: P = { id: 3, code: "TD", name: "Time Deposit", kind: "time_deposit", is_active: true };
const TD2: P = { id: 4, code: "TD2", name: "Time Deposit 2", kind: "time_deposit", is_active: false };

const BOOKS_FIRST = "Set up savings in the books first (Savings → Settings). It needs the chart of accounts.";

// ── Open Account (14zfbg0db6m) and Place Time Deposit (14zfbg0db6v) ──

test("an active product is offered, and an inactive one is listed but can't be picked", () => {
  const choice = productChoice({ products: [RS, KS, TD], kind: "regular", booksReady: true, canManage: false });
  assert.deepEqual(choice.options, [
    { value: "1", label: "Regular Savings (RS)" },
    { value: "2", label: "Kiddie Savings (KS) · Not active yet", disabled: true },
  ]);
  assert.equal(choice.selectable, 1);
  assert.equal(choice.empty, null);
});

test("with only inactive products and the books not set up, it says why and where to fix it", () => {
  const choice = productChoice({ products: [KS], kind: "regular", booksReady: false, canManage: true });
  assert.equal(choice.selectable, 0);
  assert.deepEqual(choice.options, [{ value: "2", label: "Kiddie Savings (KS) · Not active yet", disabled: true }]);
  assert.equal(choice.empty?.message, `No savings product is turned on yet. ${BOOKS_FIRST}`);
  assert.deepEqual(choice.empty?.link, { href: "/savings/settings", label: "Open Savings Settings" });
});

test("with the books set up, it points to the products screen to turn one on", () => {
  const choice = productChoice({ products: [TD2], kind: "time_deposit", booksReady: true, canManage: true });
  assert.equal(choice.empty?.message, "No time deposit product is turned on yet. Turn a product on in Savings → Products.");
  assert.deepEqual(choice.empty?.link, { href: "/savings/products", label: "Open Savings Products" });
});

test("a user who can't fix it gets the reason without a link", () => {
  const choice = productChoice({ products: [KS], kind: "regular", booksReady: false, canManage: false });
  assert.equal(choice.empty?.message, `No savings product is turned on yet. ${BOOKS_FIRST}`);
  assert.equal(choice.empty?.link, null);
});

test("when the settings can't be read, a generic sentence names both places", () => {
  const choice = productChoice({ products: [KS], kind: "regular", booksReady: null, canManage: false });
  assert.equal(
    choice.empty?.message,
    "No savings product is turned on yet. A product can be turned on once savings is set up in the books (Savings → Settings), in Savings → Products.",
  );
  assert.equal(choice.empty?.link, null);
});

test("no product of the kind at all asks for one to be added", () => {
  const regular = productChoice({ products: [TD], kind: "regular", booksReady: true, canManage: true });
  assert.equal(regular.options.length, 0);
  assert.equal(regular.empty?.message, "No savings product has been set up yet. Add one in Savings → Products.");
  assert.deepEqual(regular.empty?.link, { href: "/savings/products", label: "Open Savings Products" });
  const td = productChoice({ products: [], kind: "time_deposit", booksReady: false, canManage: false });
  assert.equal(td.empty?.message, `No time deposit product has been set up yet. ${BOOKS_FIRST}`);
});

test("a member who can't open any active product is told so; those products stay listed, not pickable", () => {
  const choice = productChoice({
    products: [RS, KS],
    kind: "regular",
    eligibleIds: new Set<string>(),
    heldProductIds: new Set<string>(),
    booksReady: true,
    canManage: true,
  });
  assert.equal(choice.selectable, 0);
  assert.deepEqual(choice.options, [
    { value: "1", label: "Regular Savings (RS) · Not open to this member", disabled: true },
    { value: "2", label: "Kiddie Savings (KS) · Not active yet", disabled: true },
  ]);
  assert.equal(
    choice.empty?.message,
    "This member can't open any active product. They may already hold an account in each one, or a product's rules leave them out.",
  );
  assert.equal(choice.empty?.link, null);
});

// Browser check 5: one reason. A member who already holds every active
// product reads the member check's own sentence, so the dialog adds none.
test("a member who already holds an account in every active product gets no second notice", () => {
  const RS2: P = { id: 5, code: "RS2", name: "Senior Savings", kind: "regular", is_active: true };
  const choice = productChoice({
    products: [RS, RS2, KS],
    kind: "regular",
    eligibleIds: new Set<string>(),
    heldProductIds: new Set(["1", "5"]),
    booksReady: true,
    canManage: true,
  });
  assert.equal(choice.selectable, 0);
  assert.equal(choice.empty, null);
  // Holding only some of them, the rest ruled out by the product rules: the dialog's notice explains it.
  const some = productChoice({
    products: [RS, RS2],
    kind: "regular",
    eligibleIds: new Set<string>(),
    heldProductIds: new Set(["1"]),
    booksReady: true,
    canManage: true,
  });
  assert.match(some.empty?.message ?? "", /^This member can't open any active product\./);
});

test("the member check narrows the active products to the ones the member may open", () => {
  const RS2: P = { id: 5, code: "RS2", name: "Senior Savings", kind: "regular", is_active: true };
  const choice = productChoice({
    products: [RS, RS2],
    kind: "regular",
    eligibleIds: new Set(["5"]),
    booksReady: true,
    canManage: false,
  });
  assert.deepEqual(choice.options, [
    { value: "5", label: "Senior Savings (RS2)" },
    { value: "1", label: "Regular Savings (RS) · Not open to this member", disabled: true },
  ]);
  assert.equal(choice.selectable, 1);
  assert.equal(choice.empty, null);
});

test("while the products load there is nothing to say yet", () => {
  const choice = productChoice({ products: null, kind: "regular", booksReady: null, canManage: true });
  assert.deepEqual(choice, { options: [], selectable: 0, empty: null });
});

// ── Term (Place Time Deposit) ──

test("the Term options are the chosen product's terms, with a placeholder that says what to do", () => {
  assert.deepEqual(termChoice(null), { options: [], placeholder: "Choose a product first" });
  assert.deepEqual(termChoice({ term_options_days: [90, 30] }), {
    options: [
      { value: "90", label: "90 days" },
      { value: "30", label: "30 days" },
    ],
    placeholder: "Choose a term",
  });
  assert.deepEqual(termChoice({ term_options_days: [] }), {
    options: [],
    placeholder: "This product offers no term",
  });
});
