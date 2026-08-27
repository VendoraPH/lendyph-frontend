import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collateralLock,
  holdersSentence,
  isLocked,
  lockLabel,
} from "./collateral-lock";

const ref = (id: number, n: string | null = `LN-${String(id).padStart(6, "0")}`) => ({
  id,
  loan_account_number: n,
});

test("an empty active_loans is free", () => {
  const lock = collateralLock({ active_loans: [] });
  assert.equal(lock.state, "free");
  assert.equal(isLocked(lock), false);
  assert.equal(lockLabel(lock), null);
  assert.equal(holdersSentence(lock), null);
});

test("one active holder is held and named", () => {
  const lock = collateralLock({ active_loans: [ref(1)] });
  assert.equal(lock.state, "held");
  assert.equal(isLocked(lock), true);
  assert.equal(lockLabel(lock), "Tagged to loan LN-000001");
  assert.equal(holdersSentence(lock), "Currently pledged to active loan LN-000001.");
});

/**
 * The state the old scalar `active_loan_id` could not represent. On the screen
 * whose job is spotting double pledges, showing one of two holders is the
 * failure, not the fix.
 */
test("two active holders are reported as two, not as the first one", () => {
  const lock = collateralLock({ active_loans: [ref(1), ref(7)] });
  assert.equal(lock.state, "held");
  assert.equal(lock.holders.length, 2);
  assert.equal(lockLabel(lock), "Tagged to 2 active loans");
  assert.equal(
    holdersSentence(lock),
    "Currently pledged to active loans LN-000001, LN-000007.",
  );
});

// The whole reason `unknown` exists. `whenLoaded` omits the key rather than
// sending [], so "absent" must never collapse into "free".
test("an absent active_loans is unknown, NOT free", () => {
  const lock = collateralLock({});
  assert.equal(lock.state, "unknown");
  assert.equal(isLocked(lock), true, "unknown must fail safe, like held");
  assert.equal(lockLabel(lock), "Lock state unknown");
});

test("null, undefined and a malformed value are all unknown", () => {
  assert.equal(collateralLock(null).state, "unknown");
  assert.equal(collateralLock(undefined).state, "unknown");
  assert.equal(collateralLock({ active_loans: null }).state, "unknown");
  assert.equal(
    collateralLock({ active_loans: "nope" as unknown as [] }).state,
    "unknown",
  );
});

/**
 * GET /loans/{id}/collaterals includes the viewed loan when it is itself
 * active. Without the exclusion an edit form calls every collateral the loan
 * already holds "locked" and the user cannot keep their own security.
 */
test("the loan on screen is excluded from its own lock", () => {
  const held = { active_loans: [ref(42)] };
  assert.equal(collateralLock(held).state, "held");
  assert.equal(collateralLock(held, { exceptLoanId: 42 }).state, "free");
});

test("excluding my loan still reports a second, genuine holder", () => {
  const lock = collateralLock(
    { active_loans: [ref(42), ref(99)] },
    { exceptLoanId: 42 },
  );
  assert.equal(lock.state, "held");
  assert.deepEqual(lock.holders.map((h) => h.id), [99]);
  assert.equal(lockLabel(lock), "Tagged to loan LN-000099");
});

test("a null exceptLoanId excludes nothing", () => {
  const held = { active_loans: [ref(42)] };
  assert.equal(collateralLock(held, { exceptLoanId: null }).state, "held");
  assert.equal(collateralLock(held, { exceptLoanId: undefined }).state, "held");
});

// exceptLoanId is a real loan id; 0 is not, but it is falsy, and this codebase
// has already shipped one bug from gating on truthiness instead of presence.
test("exceptLoanId 0 is treated as a value, not as absent", () => {
  const lock = collateralLock({ active_loans: [ref(0, "LN-ZERO")] }, { exceptLoanId: 0 });
  assert.equal(lock.state, "free");
});

test("a holder with no account number still gets a usable label", () => {
  const lock = collateralLock({ active_loans: [ref(5, null)] });
  assert.equal(lockLabel(lock), "Tagged to loan #5");
});

test("junk entries inside active_loans are dropped, not rendered", () => {
  const lock = collateralLock({
    active_loans: [null, { id: "x" }, ref(3)] as never,
  });
  assert.equal(lock.state, "held");
  assert.deepEqual(lock.holders.map((h) => h.id), [3]);
});
