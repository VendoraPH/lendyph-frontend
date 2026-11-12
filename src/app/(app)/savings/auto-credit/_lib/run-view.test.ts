import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsAutoCreditRunResult } from "@/types/savings-servicing";
import { canProcess, processedMessage, runHeadline, runLineAccount, runTotalCards } from "./run-view";

// A stubbed server answer: one credit, one skip in words, one reversed credit.
const stub: SavingsAutoCreditRunResult = {
  run_id: null,
  cycle_date: "2026-10-31",
  posting_date: "2026-11-12",
  method: "bank_transfer",
  reference_number: null,
  credits: [
    { instruction_id: 1, account_id: 10, account_number: "SA-0010", borrower_name: "Ana Cruz", amount: "500.00", transaction_id: null, reference: null },
  ],
  skipped: [
    {
      instruction_id: 2,
      account_id: 11,
      account_number: "SA-0011",
      borrower_name: "Ben Reyes",
      amount: "300.00",
      reason: "SA-0011 is frozen and takes no deposits until it is unfrozen.",
    },
  ],
  already_credited: [
    {
      instruction_id: 3,
      account_id: 12,
      account_number: "SA-0012",
      borrower_name: "Carla Dizon",
      amount: "250.00",
      transaction_id: 99,
      reference: "SAV-000099",
      status: "reversed",
      status_label: "Credited, then reversed",
    },
  ],
  totals: { credit_count: 1, credit_amount: "500.00", skipped_count: 1, skipped_amount: "300.00", already_credited_count: 1 },
};

test("the cards show the server's counts and amounts, never a browser sum", () => {
  assert.deepEqual(runTotalCards(stub, false), [
    { label: "To credit", value: "1 · ₱500.00" },
    { label: "Skipped", value: "1 · ₱300.00" },
    { label: "Already credited this cycle", value: "1" },
  ]);
  assert.equal(runTotalCards({ ...stub, run_id: 5 }, true)[0].label, "Credited");
});

test("a late preview says the credits post today's date", () => {
  assert.equal(
    runHeadline(stub, false),
    "The October 31, 2026 cycle. Nothing is posted until you process the run. A late run posts today's date (November 12, 2026).",
  );
  assert.equal(runHeadline({ ...stub, posting_date: "2026-10-31" }, false), "The October 31, 2026 cycle. Nothing is posted until you process the run.");
  assert.equal(runHeadline(stub, true), "The October 31, 2026 cycle, posted on November 12, 2026.");
});

test("the processed toast reads the server's totals", () => {
  assert.deepEqual(processedMessage({ ...stub, run_id: 5 }), {
    title: "1 account credited (₱500.00)",
    description: "1 skipped, 1 already credited.",
  });
  const rerun = { ...stub, totals: { ...stub.totals, credit_count: 0, credit_amount: "0.00" } };
  assert.equal(processedMessage(rerun).title, "Nothing to credit this cycle");
});

test("Process is offered only when the preview has a credit to post", () => {
  assert.equal(canProcess(null), false);
  assert.equal(canProcess(stub), true);
  assert.equal(canProcess({ ...stub, totals: { ...stub.totals, credit_count: 0 } }), false);
});

test("a run line names its account and member, never only the instruction number", () => {
  assert.deepEqual(runLineAccount(stub.credits[0]), { account: "SA-0010", member: "Ana Cruz" });
  assert.deepEqual(runLineAccount({ ...stub.credits[0], account_number: null, borrower_name: null }), {
    account: "Account #10",
    member: "—",
  });
});
