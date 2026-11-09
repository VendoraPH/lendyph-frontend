import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Permission } from "@/types";
import {
  AUTO_PAY_TOGGLE_GATE,
  LOAN_ADJUSTMENT_CREATE_GATE,
  PAYMENT_CREATE_GATE,
  PLEDGE_ENTRY_CREATE_GATE,
  PLEDGE_UPDATE_GATE,
  UPON_MATURITY_PREVIEW_GATE,
  recordPaymentGate,
} from "./lending-write-gates";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function holding(...permissions: Permission[]) {
  return (p: Permission) => permissions.includes(p);
}

// The permission each write needs is the one the server's form request checks.
test("each lending write is gated by the permission the server checks", () => {
  assert.equal(PAYMENT_CREATE_GATE.permission, "payments:create");
  assert.equal(LOAN_ADJUSTMENT_CREATE_GATE.permission, "loan_adjustments:create");
  assert.equal(PLEDGE_ENTRY_CREATE_GATE.permission, "share_capital:create");
  assert.equal(AUTO_PAY_TOGGLE_GATE.permission, "auto_pay:toggle");
  assert.equal(PLEDGE_UPDATE_GATE.permission, "share_capital:update");
  for (const gate of [
    PLEDGE_UPDATE_GATE,
    PAYMENT_CREATE_GATE,
    LOAN_ADJUSTMENT_CREATE_GATE,
    PLEDGE_ENTRY_CREATE_GATE,
    AUTO_PAY_TOGGLE_GATE,
    UPON_MATURITY_PREVIEW_GATE,
  ]) {
    assert.match(gate.tooltip, /permission/);
    assert.doesNotMatch(gate.tooltip, /[a-z_]+:[a-z_]+/, "the reason reads in words, never a key");
  }
});

test("Record Payment needs payments:create first, then payments:view for an upon-maturity loan", () => {
  // A read-only role (the Accountant) holds payments:view but not create.
  assert.equal(recordPaymentGate(false, holding("payments:view")), PAYMENT_CREATE_GATE);
  assert.equal(recordPaymentGate(true, holding("payments:view")), PAYMENT_CREATE_GATE);
  assert.equal(recordPaymentGate(false, holding("payments:create")), PAYMENT_CREATE_GATE);
  assert.equal(recordPaymentGate(true, holding("payments:create")), UPON_MATURITY_PREVIEW_GATE);
  assert.equal(recordPaymentGate(true, holding("payments:create", "payments:view")), UPON_MATURITY_PREVIEW_GATE);
});

test("the loan page gates Record Payment and New Adjustment", () => {
  const page = read("src/app/(app)/loans/[id]/page.tsx");
  const start = page.indexOf('title="Ledger"');
  const header = page.slice(start, page.indexOf("repaymentsShortfall &&", start));
  assert.ok(start > -1 && header.length > 0);
  assert.doesNotMatch(header, /<Button\b/, "every action in the Ledger header is a PermissionButton");
  assert.match(
    header,
    /<PermissionButton\s+permission=\{LOAN_ADJUSTMENT_CREATE_GATE\.permission\}\s+tooltip=\{LOAN_ADJUSTMENT_CREATE_GATE\.tooltip\}[\s\S]*?New Adjustment/,
  );
  assert.match(
    header,
    /<PermissionButton\s+permission=\{recordPayment\.permission\}\s+tooltip=\{recordPayment\.tooltip\}[\s\S]*?Record Payment/,
  );
  assert.match(page, /const recordPayment = recordPaymentGate\(isUponMaturityLoan, can\)/);
});

test("Payment Entry's Pay needs payments:create", () => {
  const page = read("src/app/(app)/payments/page.tsx");
  assert.match(
    page,
    /<PermissionButton\s+permission=\{PAYMENT_CREATE_GATE\.permission\}\s+tooltip=\{PAYMENT_CREATE_GATE\.tooltip\}[^>]*?>[\s\S]{0,400}?Pay\s*<ArrowRight/,
  );
});

test("Pledge Entry's manual entry needs share_capital:create", () => {
  const page = read("src/app/(app)/share-capital/pledges/page.tsx");
  assert.match(
    page,
    /<PermissionButton\s+permission=\{PLEDGE_ENTRY_CREATE_GATE\.permission\}\s+tooltip=\{PLEDGE_ENTRY_CREATE_GATE\.tooltip\}[\s\S]{0,800}?Entry\s*<\/PermissionButton>/,
  );
});

test("the Loans list's Auto-Pay button needs auto_pay:toggle", () => {
  const table = read("src/app/(app)/loans/_components/loan-table.tsx");
  const start = table.indexOf("offersAutoPay(loan.status) ?");
  const cell = table.slice(start, table.indexOf("</TableCell>", start));
  assert.ok(start > -1 && cell.length > 0);
  assert.doesNotMatch(cell, /<button\b/);
  assert.match(
    cell,
    /<PermissionButton\s+permission=\{AUTO_PAY_TOGGLE_GATE\.permission\}\s+tooltip=\{AUTO_PAY_TOGGLE_GATE\.tooltip\}/,
  );
});

test("Pledge Entry's bulk Manual Entry needs share_capital:create", () => {
  const page = read("src/app/(app)/share-capital/pledges/page.tsx");
  const start = page.indexOf("Bulk Entry Action Bar");
  const bar = page.slice(start, page.indexOf("Manual Entry", start) + "Manual Entry".length);
  assert.ok(start > -1 && bar.length > 0);
  assert.doesNotMatch(bar, /<Button\b/);
  assert.match(
    bar,
    /<PermissionButton\s+permission=\{PLEDGE_ENTRY_CREATE_GATE\.permission\}\s+tooltip=\{PLEDGE_ENTRY_CREATE_GATE\.tooltip\}/,
  );
});

test("a pledge's amount, schedule and auto-credit need share_capital:update, with the reason in words", () => {
  const page = read("src/app/(app)/share-capital/pledges/page.tsx");
  assert.match(page, /const canUpdatePledge = can\(PLEDGE_UPDATE_GATE\.permission\)/);
  assert.match(page, /const pledgeUpdateReason = canUpdatePledge \? null : PLEDGE_UPDATE_GATE\.tooltip/);
  assert.equal(page.match(/<DisabledReason reason=\{pledgeUpdateReason\}>/g)?.length, 3);
  assert.match(page, /onClick=\{canUpdatePledge \? \(\) => startAmountEdit\(pledge\) : undefined\}/);
  assert.match(page, /onClick=\{canUpdatePledge \? \(\) => startScheduleEdit\(pledge\) : undefined\}/);
  assert.match(page, /<Switch\s+checked=\{pledge\.autoCredit\}\s+disabled=\{!canUpdatePledge\}/);
});

test("without payments:create, Payment Entry's row and its disabled Pay don't open Record Payment", () => {
  const page = read("src/app/(app)/payments/page.tsx");
  assert.match(page, /const canRecordPayment = can\(PAYMENT_CREATE_GATE\.permission\)/);
  // The row opens the dialog only for a user who can record a payment.
  assert.match(page, /onClick=\{canRecordPayment \? \(\) => handleSelectLoan\(loan\) : undefined\}/);
  assert.doesNotMatch(page, /onClick=\{\(\) => handleSelectLoan\(loan\)\}/);
  // A click on the disabled Pay (its tooltip wrapper) stops at its cell.
  const pay = page.indexOf("permission={PAYMENT_CREATE_GATE.permission}");
  const cellStart = page.lastIndexOf("<TableCell", pay);
  assert.match(page.slice(cellStart, pay), /^<TableCell onClick=\{\(e\) => e\.stopPropagation\(\)\}>/);
});
