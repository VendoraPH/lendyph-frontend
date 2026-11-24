import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_RECEIPT_TOO_MANY,
  PUBLIC_RECEIPT_UNAVAILABLE,
  isShareToken,
  publicReceiptErrorMessage,
  publicReceiptLines,
  referenceEnding,
  shareLinkStatusText,
  shareLinkUrl,
} from "./receipt-share";
import type { PublicReceipt, ReceiptShareLink } from "@/types/receipt-share";

const TOKEN = "Tq7m2Xc9Lp4Rz8Kd1Vb6Nw3Hy5Gf0Sa2Jx-Eu_Wo9Ck";

function receipt(overrides: Partial<PublicReceipt> = {}): PublicReceipt {
  return {
    cooperative: { name: "Binhs Multi-Purpose Cooperative", logo_url: null },
    receipt_number: "RCP-000123",
    payment_date: "2026-11-20",
    member_name: "M. C. D. Santos",
    method: "GCash",
    reference_last4: "7890",
    amount_paid: "12000.00",
    principal_applied: "10000.00",
    interest_applied: "1800.00",
    penalty_applied: "150.50",
    insurance_applied: "49.50",
    overpayment: "0.00",
    build_up_credited: "0.00",
    overpayment_kept: "0.00",
    status: "completed",
    voided_on: null,
    ...overrides,
  };
}

function link(overrides: Partial<ReceiptShareLink> = {}): ReceiptShareLink {
  return {
    id: 4,
    status: "active",
    status_label: "Active",
    created_at: "2026-11-24 09:15:00",
    created_by: "Ana Reyes",
    expires_at: "2026-12-24 09:15:00",
    revoked_at: null,
    revoked_by: null,
    ...overrides,
  };
}

test("the token is 43 base64url characters, nothing else", () => {
  assert.equal(TOKEN.length, 43);
  assert.ok(isShareToken(TOKEN));
  assert.ok(!isShareToken(TOKEN.slice(1)));
  assert.ok(!isShareToken(`${TOKEN}A`));
  assert.ok(!isShareToken(`${TOKEN.slice(1)}+`));
  assert.ok(!isShareToken(`${TOKEN.slice(1)}/`));
  assert.ok(!isShareToken(""));
});

test("the link is the app's own address plus /r/ and the token", () => {
  assert.equal(shareLinkUrl("https://binhs.lendyph.com", TOKEN), `https://binhs.lendyph.com/r/${TOKEN}`);
  assert.equal(shareLinkUrl("https://binhs.lendyph.com/", TOKEN), `https://binhs.lendyph.com/r/${TOKEN}`);
});

test("the status reads in words, with Manila dates and who revoked it", () => {
  assert.equal(shareLinkStatusText(link()), "Working until Dec 24, 2026. Made by Ana Reyes on Nov 24, 2026.");
  assert.equal(shareLinkStatusText(link({ status: "expired", status_label: "Expired" })), "The last link expired on Dec 24, 2026.");
  assert.equal(
    shareLinkStatusText(link({ status: "revoked", status_label: "Revoked", revoked_at: "2026-11-25 10:00:00", revoked_by: "Ben Cruz" })),
    "The last link was revoked on Nov 25, 2026 by Ben Cruz.",
  );
  assert.equal(
    shareLinkStatusText(link({ status: "revoked", status_label: "Revoked", revoked_at: "2026-11-25 10:00:00", revoked_by: null })),
    "The last link was revoked on Nov 25, 2026.",
  );
  assert.equal(shareLinkStatusText(link({ created_by: null })), "Working until Dec 24, 2026.");
});

test("only the last 4 characters of a reference are ever shown", () => {
  assert.equal(referenceEnding("7890"), "Ending in 7890");
  assert.equal(referenceEnding(null), null);
  assert.equal(referenceEnding(""), null);
});

test("the split shows the server's figures as pesos, the premium only when one was collected", () => {
  assert.deepEqual(publicReceiptLines(receipt()), [
    { label: "Insurance premium", amount: "₱49.50" },
    { label: "Penalty", amount: "₱150.50" },
    { label: "Interest", amount: "₱1,800.00" },
    { label: "Principal", amount: "₱10,000.00" },
  ]);

  const noPremium = publicReceiptLines(receipt({ insurance_applied: "0.00" }));
  assert.deepEqual(noPremium.map((line) => line.label), ["Penalty", "Interest", "Principal"]);
});

test("build-up and overpayment follow the staff receipt's own rule", () => {
  const split = publicReceiptLines(receipt({ insurance_applied: "0.00", overpayment: "750.00", build_up_credited: "500.00", overpayment_kept: "250.00" }));
  assert.deepEqual(split.slice(3), [
    { label: "Share Capital Build-Up", amount: "₱500.00" },
    { label: "Advance / Overpayment", amount: "₱250.00" },
  ]);

  const unknown = publicReceiptLines(receipt({ insurance_applied: "0.00", overpayment: "750.00", build_up_credited: null, overpayment_kept: null }));
  assert.deepEqual(unknown.slice(3), [{ label: "Build-Up / Overpayment", amount: "₱750.00" }]);
});

test("a refused link reads one message whatever the reason, and a limit reads its own", () => {
  const status = (code: number) => ({ isAxiosError: true, response: { status: code, data: { message: "Not found." } } });
  assert.equal(publicReceiptErrorMessage(status(404)), PUBLIC_RECEIPT_UNAVAILABLE);
  assert.equal(publicReceiptErrorMessage(status(403)), PUBLIC_RECEIPT_UNAVAILABLE);
  assert.equal(publicReceiptErrorMessage(status(429)), PUBLIC_RECEIPT_TOO_MANY);
  assert.match(publicReceiptErrorMessage(new Error("Network Error")), /couldn't open/);
  assert.doesNotMatch(PUBLIC_RECEIPT_UNAVAILABLE, /expired|revoked|exist/i, "the message never says which");
});
