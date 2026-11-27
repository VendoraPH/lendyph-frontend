import { test } from "node:test";
import assert from "node:assert/strict";
import { borrowerService, savingsService, timeDepositService } from "@/services";
import type { Permission } from "@/types";
import { PRINTABLE_CATALOG, visiblePrintables } from "./catalog";
import {
  fetchSavingsAccountPayload,
  fetchSavingsWithdrawalPayload,
  fetchTimeDepositPayload,
} from "./savings-fetchers";

const SAVINGS_IDS = [
  "savings_opening_form",
  "savings_agreement",
  "savings_closure_form",
  "savings_dormancy_notice",
  "savings_withdrawal_slip",
  "time_deposit_maturity_notice",
  "time_deposit_early_termination",
];

/** Swap service methods for the length of one test, and count the calls. */
async function withStubs(
  stubs: Array<[Record<string, unknown>, string, (...args: unknown[]) => unknown]>,
  run: (calls: string[]) => Promise<void>,
) {
  const calls: string[] = [];
  const originals = stubs.map(([target, name]) => [target, name, target[name]] as const);
  for (const [target, name, fn] of stubs) {
    target[name] = async (...args: unknown[]) => {
      calls.push(name);
      return fn(...args);
    };
  }
  try {
    await run(calls);
  } finally {
    for (const [target, name, original] of originals) target[name] = original;
  }
}

const savings = savingsService as unknown as Record<string, unknown>;
const borrowers = borrowerService as unknown as Record<string, unknown>;
const deposits = timeDepositService as unknown as Record<string, unknown>;
const allow = (granted: Permission[]) => (p: Permission) => granted.includes(p);

const ACCOUNT = { id: 9, borrower_id: 7, status: "active", product: { id: 1 } };

test("the seven savings documents are in the catalog, behind the savings switch and savings:view", () => {
  for (const id of SAVINGS_IDS) {
    const doc = PRINTABLE_CATALOG.find((p) => p.id === id);
    assert.ok(doc, id);
    assert.equal(doc.permission, "savings:view", id);
    assert.equal(doc.available, false, id);
  }
  const subjects = Object.fromEntries(PRINTABLE_CATALOG.map((p) => [p.id, p.subject]));
  assert.equal(subjects.savings_opening_form, "savings_account");
  assert.equal(subjects.savings_withdrawal_slip, "savings_withdrawal");
  assert.equal(subjects.time_deposit_early_termination, "time_deposit");
  // NEXT_PUBLIC_ENABLE_SAVINGS is unset here: even a user with every permission sees none of them.
  const visible = visiblePrintables(() => true).map((p) => p.id);
  for (const id of SAVINGS_IDS) assert.equal(visible.includes(id as never), false, id);
  assert.ok(visible.includes("official_receipt"));
});

test("the member record is read only with borrowers:view", async () => {
  await withStubs(
    [
      [savings, "account", () => ACCOUNT],
      [borrowers, "detail", () => ({ id: 7, address: "12 Rizal St" })],
      [savings, "products", () => [{ id: 1, name: "Regular" }, { id: 2, name: "Other" }]],
    ],
    async (calls) => {
      const without = await fetchSavingsAccountPayload(9, { member: true, product: true }, allow([]));
      assert.equal(without?.member, null);
      assert.equal(calls.includes("detail"), false);
      assert.deepEqual(without?.product, { id: 1, name: "Regular" });

      const withIt = await fetchSavingsAccountPayload(9, { member: true }, allow(["borrowers:view"]));
      assert.deepEqual(withIt?.member, { id: 7, address: "12 Rizal St" });
    },
  );
});

test("a member the server hides (another branch) leaves the details blank, not the form", async () => {
  await withStubs(
    [
      [savings, "account", () => ACCOUNT],
      [borrowers, "detail", () => Promise.reject(new Error("404"))],
    ],
    async () => {
      const payload = await fetchSavingsAccountPayload(9, { member: true }, allow(["borrowers:view"]));
      assert.ok(payload);
      assert.equal(payload.member, null);
    },
  );
});

test("the closing quote is read only with savings:close, and a closed account reads its payout row", async () => {
  await withStubs(
    [
      [savings, "account", () => ACCOUNT],
      [savings, "closingQuote", () => ({ payout_amount: "10.00" })],
    ],
    async (calls) => {
      assert.equal((await fetchSavingsAccountPayload(9, { closing: true }, allow([])))?.quote, null);
      assert.equal(calls.includes("closingQuote"), false);
      const quoted = await fetchSavingsAccountPayload(9, { closing: true }, allow(["savings:close"]));
      assert.deepEqual(quoted?.quote, { payout_amount: "10.00" });
    },
  );
  await withStubs(
    [
      [savings, "account", () => ({ ...ACCOUNT, status: "closed" })],
      [savings, "accountTransactions", (_id: unknown, params: unknown) => ({ data: [{ type: (params as { type: string }).type, debit: "5.00" }] })],
    ],
    async () => {
      const payload = await fetchSavingsAccountPayload(9, { closing: true }, allow(["savings:close"]));
      assert.deepEqual(payload?.closing, { type: "closing", debit: "5.00" });
      assert.equal(payload?.quote, null);
    },
  );
});

test("an account that couldn't be read gives no payload, so the form prints blank", async () => {
  await withStubs([[savings, "account", () => Promise.reject(new Error("404"))]], async () => {
    assert.equal(await fetchSavingsAccountPayload(9, { member: true }, allow(["borrowers:view"])), null);
  });
});

test("the withdrawal slip reads the transaction and its account", async () => {
  await withStubs(
    [
      [savings, "transaction", () => ({ id: 31, account_id: 9, type: "withdrawal" })],
      [savings, "account", () => ACCOUNT],
    ],
    async () => {
      const payload = await fetchSavingsWithdrawalPayload(31);
      assert.equal((payload?.account as { id: number }).id, 9);
    },
  );
});

test("the pre-termination quote is read only for a running placement and with savings:close", async () => {
  await withStubs(
    [
      [deposits, "get", () => ({ id: 5, status: "active" })],
      [deposits, "preterminationQuote", () => ({ payout: "1.00" })],
    ],
    async (calls) => {
      assert.equal((await fetchTimeDepositPayload(5, true, allow([])))?.quote, null);
      assert.equal((await fetchTimeDepositPayload(5, false, allow(["savings:close"])))?.quote, null);
      assert.equal(calls.includes("preterminationQuote"), false);
      assert.deepEqual((await fetchTimeDepositPayload(5, true, allow(["savings:close"])))?.quote, { payout: "1.00" });
    },
  );
  await withStubs(
    [
      [deposits, "get", () => ({ id: 5, status: "matured" })],
      [deposits, "preterminationQuote", () => ({ payout: "1.00" })],
    ],
    async (calls) => {
      assert.equal((await fetchTimeDepositPayload(5, true, allow(["savings:close"])))?.quote, null);
      assert.equal(calls.includes("preterminationQuote"), false);
    },
  );
});
