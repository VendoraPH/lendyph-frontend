/**
 * The method and reference every money screen sends, pinned at the wire.
 *
 * WHAT THIS PROVES: the release, an extension on "pay" (and not on "defer"), a
 * member's share capital entry, the bulk batch (one method for every row) and
 * the auto-credit run send `method` and `reference_number` exactly as built;
 * an auto-credit run with nothing picked sends an empty body, so the server
 * takes its default (Bank); and the release preview's `restructure` block
 * reaches the dialog untouched; and "Send back for approval" PATCHes the
 * reason and hands back the reloaded loan, or the server's refusal.
 * WHAT IT DOES NOT PROVE: the server's rules or journals (backend tests).
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";

interface Seen {
  method: string;
  path: string;
  body: unknown;
}

let server: Server;
let routes: Record<string, [number, unknown]> = {};
const seen: Seen[] = [];
let loanService: typeof import("./loan.service").loanService;
let shareCapitalService: typeof import("./share-capital.service").shareCapitalService;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
      seen.push({ method: req.method ?? "", path, body: raw ? JSON.parse(raw) : null });
      const [status, body] = routes[`${req.method} ${path}`] ?? [404, { message: "not stubbed" }];
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ loanService } = await import("./loan.service"));
  ({ shareCapitalService } = await import("./share-capital.service"));
});

after(() => {
  server?.close();
});

beforeEach(() => {
  routes = {};
  seen.length = 0;
});

test("the release sends the method and reference with the fingerprint", async () => {
  routes["PATCH /loans/7/release"] = [200, { data: { id: 7 } }];
  await loanService.release(7, { fee_fingerprint: "9f2c1e", method: "gcash", reference_number: "GC-77" });
  assert.deepEqual(seen, [
    { method: "PATCH", path: "/loans/7/release", body: { fee_fingerprint: "9f2c1e", method: "gcash", reference_number: "GC-77" } },
  ]);
});

test("the release preview's restructure block reaches the dialog untouched", async () => {
  const restructure = {
    carried_principal: "40000.00",
    capitalised_interest: "1500.00",
    capitalised_penalty: "250.00",
    written_off_principal: "0.00",
    collected_now: "850.00",
    paid_out: "0.00",
  };
  routes["GET /loans/7/release-preview"] = [
    200,
    { data: { deductions: [], total_deductions: "850.00", net_proceeds: "0.00", fee_fingerprint: "a", restructure } },
  ];
  const preview = await loanService.releasePreview(7);
  assert.deepEqual(preview.restructure, restructure);
});

test("an extension on pay sends how the collection was received", async () => {
  routes["POST /loans/7/extend"] = [200, { data: { id: 7 } }];
  await loanService.extend(7, { interest_option: "pay", method: "maya", reference_number: "MY-1" });
  assert.deepEqual(seen[0].body, { interest_option: "pay", method: "maya", reference_number: "MY-1" });
});

test("an extension on defer sends neither", async () => {
  routes["POST /loans/7/extend"] = [200, { data: { id: 7 } }];
  await loanService.extend(7, { interest_option: "defer", remarks: "member asked" });
  assert.deepEqual(seen[0].body, { interest_option: "defer", remarks: "member asked" });
});

test("a member's share capital entry sends its method and reference", async () => {
  routes["POST /share-capital/ledger"] = [201, { data: { id: 1 } }];
  await shareCapitalService.ledgerCreate({
    borrower_id: 3,
    date: "2026-11-09",
    description: "Manual credit entry",
    type: "credit",
    amount: 500,
    method: "bank_transfer",
    reference_number: "BT-1",
  });
  assert.deepEqual(seen[0], {
    method: "POST",
    path: "/share-capital/ledger",
    body: {
      borrower_id: 3,
      date: "2026-11-09",
      description: "Manual credit entry",
      type: "credit",
      amount: 500,
      method: "bank_transfer",
      reference_number: "BT-1",
    },
  });
});

test("the bulk batch sends one method and reference beside its entries", async () => {
  routes["POST /pledges/bulk-entries"] = [201, { data: { processed_count: 2 } }];
  await shareCapitalService.pledgeBulkEntries({
    entries: [
      { pledge_id: 1, amount: 100, type: "credit", date: "2026-11-09" },
      { pledge_id: 2, amount: 50, type: "debit", date: "2026-11-09" },
    ],
    method: "gcash",
    reference_number: "GC-5",
  });
  assert.deepEqual(seen[0].body, {
    entries: [
      { pledge_id: 1, amount: 100, type: "credit", date: "2026-11-09" },
      { pledge_id: 2, amount: 50, type: "debit", date: "2026-11-09" },
    ],
    method: "gcash",
    reference_number: "GC-5",
  });
});

test("an auto-credit run sends the settlement account and reference picked", async () => {
  routes["POST /auto-credit/process"] = [200, { data: { processed_count: 4, total_amount: 2000, processed_at: "2026-11-09T01:00:00Z" } }];
  await shareCapitalService.autoCreditProcess({ method: "bank_transfer", reference_number: "BANK-11" });
  assert.deepEqual(seen[0], {
    method: "POST",
    path: "/auto-credit/process",
    body: { method: "bank_transfer", reference_number: "BANK-11" },
  });
});

test("an auto-credit run with nothing picked lets the server take Bank", async () => {
  routes["POST /auto-credit/process"] = [200, { data: { processed_count: 0, total_amount: 0, processed_at: "2026-11-09T01:00:00Z" } }];
  await shareCapitalService.autoCreditProcess();
  assert.deepEqual(seen[0].body, {});
});

test("send back for approval: PATCH with the reason, answering the reloaded loan", async () => {
  routes["PATCH /loans/7/send-back-approved"] = [
    200,
    { message: "Restructure sent back for approval.", data: { id: 7, status: "for_review", can_send_back_approved: false } },
  ];
  const loan = await loanService.sendBackApproved(7, { reason: "Source paid down after approval" });
  assert.deepEqual(seen, [
    { method: "PATCH", path: "/loans/7/send-back-approved", body: { reason: "Source paid down after approval" } },
  ]);
  assert.equal(loan.status, "for_review");
});

test("send back for approval: a refusal reaches the caller in the server's words", async () => {
  const message = "This restructure has already been released, so it can't be sent back for approval.";
  routes["PATCH /loans/7/send-back-approved"] = [422, { message, errors: { status: [message] } }];
  await assert.rejects(loanService.sendBackApproved(7, { reason: "x" }), (err: unknown) => {
    assert.equal(httpStatusOf(err), 422);
    assert.equal(getErrorMessage(err, "fallback"), message);
    return true;
  });
});
