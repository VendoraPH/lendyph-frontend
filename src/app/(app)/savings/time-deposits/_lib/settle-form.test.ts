import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsAccount } from "@/types";
import { defaultPayoutAccount, payoutAccounts, payoutFields, payoutOptions, postMaturityLabel, settleBody } from "./settle-form";

test("savings comes first when the placement names a payout account, last otherwise", () => {
  assert.deepEqual(payoutOptions({ payout_account_id: 9 }).map((o) => o.value), ["savings", "cash", "bank_transfer", "gcash", "maya"]);
  assert.deepEqual(payoutOptions({ payout_account_id: null }).map((o) => o.value), ["cash", "bank_transfer", "gcash", "maya", "savings"]);
  assert.equal(payoutOptions({ payout_account_id: null })[4].label, "Into a savings account");
});

const account = (over: Partial<SavingsAccount>) =>
  ({ id: 1, borrower_id: 5, branch_id: 2, status: "active", product: { id: 1, code: "RS", name: "Regular", kind: "regular" }, ...over }) as SavingsAccount;

test("a payout goes only into the member's own active regular accounts in the placement's branch", () => {
  const td = { borrower_id: 5, branch_id: 2 };
  const ids = payoutAccounts(td, [
    account({ id: 1 }),
    account({ id: 2, status: "dormant" }),
    account({ id: 3, branch_id: 7 }),
    account({ id: 4, borrower_id: 8 }),
    account({ id: 5, product: { id: 2, code: "TD", name: "TD", kind: "time_deposit" } }),
    account({ id: 6 }),
  ]).map((a) => a.id);
  assert.deepEqual(ids, [1, 6]);
});

test("the placement's payout account is picked first when it's offered", () => {
  assert.equal(defaultPayoutAccount({ payout_account_id: 6 }, [{ id: 1 }, { id: 6 }]), "6");
  assert.equal(defaultPayoutAccount({ payout_account_id: 9 }, [{ id: 1 }]), "");
  assert.equal(defaultPayoutAccount({ payout_account_id: null }, [{ id: 1 }]), "");
});

test("a payout into savings sends the account; one over the counter doesn't", () => {
  assert.deepEqual(payoutFields("savings", "6"), { payout_method: "savings", payout_account_id: 6 });
  assert.deepEqual(payoutFields("cash", "6"), { payout_method: "cash" });
  assert.deepEqual(payoutFields("savings", ""), { payout_method: "savings" });
  assert.deepEqual(settleBody("2026-11-10", "payout", "savings", "payout", "6"), {
    date: "2026-11-10",
    action: "payout",
    payout_method: "savings",
    payout_account_id: 6,
  });
  // A full rollover pays nothing out, so no account either.
  assert.equal("payout_account_id" in settleBody("2026-11-10", "rollover_all", "savings", "payout", "6"), false);
});

test("a payout sends its method and no next instruction", () => {
  assert.deepEqual(settleBody("2026-11-10", "payout", "cash", "rollover_all"), {
    date: "2026-11-10",
    action: "payout",
    payout_method: "cash",
  });
});

test("a full rollover pays nothing out, so it sends no payout method, and sends the next instruction", () => {
  assert.deepEqual(settleBody("2026-11-10", "rollover_all", "cash", "payout"), {
    date: "2026-11-10",
    action: "rollover_all",
    next_instruction: "payout",
  });
});

test("a principal rollover pays the interest out and sends both", () => {
  assert.deepEqual(settleBody("2026-11-10", "rollover_principal", "savings", "rollover_principal"), {
    date: "2026-11-10",
    action: "rollover_principal",
    payout_method: "savings",
    next_instruction: "rollover_principal",
  });
});

test("interest after maturity reads its days, or no days when the server couldn't work them out", () => {
  assert.equal(postMaturityLabel({ post_maturity_days: 12 }), "Interest after maturity (12 days)");
  assert.equal(postMaturityLabel({ post_maturity_days: 1 }), "Interest after maturity (1 day)");
  assert.equal(postMaturityLabel({ post_maturity_days: null }), "Interest after maturity");
});
