import { test } from "node:test";
import assert from "node:assert/strict";
import { payoutOptions, postMaturityLabel, settleBody } from "./settle-form";

test("a placement with a payout account offers it first; one without offers the counter only", () => {
  assert.deepEqual(
    payoutOptions({ payout_account_id: 9, payout_account_number: "SAV-2026-000009" }).map((o) => o.value),
    ["savings", "cash", "bank_transfer", "gcash", "maya"],
  );
  assert.equal(payoutOptions({ payout_account_id: 9, payout_account_number: "SAV-2026-000009" })[0].label, "Savings account SAV-2026-000009");
  assert.deepEqual(payoutOptions({ payout_account_id: null }).map((o) => o.value), ["cash", "bank_transfer", "gcash", "maya"]);
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
