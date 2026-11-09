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
  for (const gate of [
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
