import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsApproval, SavingsTransaction } from "@/types";
import type { ShareCapitalTransferResult } from "@/types/savings-servicing";
import {
  buildShareCapitalTransferBody,
  shareCapitalTransferBlocker,
  shareCapitalTransferOutcome,
} from "./share-capital-transfer";

const product = { id: 1, code: "RS", name: "Regular Savings", kind: "regular" as const };

test("the body carries the amount as two-decimal text, and remarks only when typed", () => {
  assert.deepEqual(buildShareCapitalTransferBody("1500", ""), { ok: true, body: { amount: "1500.00" } });
  assert.deepEqual(buildShareCapitalTransferBody(" 250.5 ", "  For the build-up  "), {
    ok: true,
    body: { amount: "250.50", remarks: "For the build-up" },
  });
});

test("a missing, zero or over-precise amount is refused in words before anything is sent", () => {
  for (const raw of ["", "0", "abc", "10.555"]) {
    const check = buildShareCapitalTransferBody(raw, "");
    assert.equal(check.ok, false, raw);
    assert.match(check.ok ? "" : check.message, /Transfer amount/);
  }
  const long = buildShareCapitalTransferBody("10", "x".repeat(501));
  assert.deepEqual(long, { ok: false, message: "The remarks can be at most 500 characters." });
});

test("only an active regular account offers the transfer", () => {
  assert.equal(shareCapitalTransferBlocker({ status: "active", product }), null);
  assert.match(shareCapitalTransferBlocker({ status: "dormant", product }) ?? "", /Only an active account/);
  assert.match(
    shareCapitalTransferBlocker({ status: "active", product: { ...product, kind: "time_deposit" } }) ?? "",
    /time deposit/,
  );
});

const posted = (balance: string | null): ShareCapitalTransferResult => ({
  transaction: { id: 9, reference: "SAV-000123", debit: "1500.00", credit: "0.00" } as SavingsTransaction,
  share_capital_entry: {
    id: 4,
    reference: "SC-000044",
    date: "2026-11-12",
    credit: "1500.00",
    method: "savings_transfer",
    reference_number: "SAV-000123",
  },
  share_capital_balance: balance,
});

test("a posted transfer names the server's amount, reference and new share capital balance", () => {
  const outcome = shareCapitalTransferOutcome({ kind: "posted", record: posted("6500.00") });
  assert.equal(outcome.title, "Transferred to share capital");
  assert.equal(
    outcome.description,
    "₱1,500.00 moved to share capital (SAV-000123). The member's share capital is now ₱6,500.00.",
  );
});

test("without share_capital:view the balance is left out, never shown as ₱0.00", () => {
  const outcome = shareCapitalTransferOutcome({ kind: "posted", record: posted(null) });
  assert.equal(outcome.description, "₱1,500.00 moved to share capital (SAV-000123).");
});

test("above the first tier it reads as sent for approval, with the tier's checkers", () => {
  const approval = { id: 3, kind: "share_capital_transfer", required_checkers: 2 } as SavingsApproval;
  const outcome = shareCapitalTransferOutcome({ kind: "sent_for_approval", approval });
  assert.equal(outcome.title, "Sent for approval. 2 different approvers must approve it before it posts.");
  assert.match(outcome.description, /Nothing moves until it is approved/);
});
