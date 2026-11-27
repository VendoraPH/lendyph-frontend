/**
 * The Chairman/Chairwoman's edit at their approval step, pinned at the wire:
 * `GET /loans/{id}/approval-edit`, `POST /loans/{id}/approval-edit/preview`
 * and `PATCH /loans/{id}/approval-edit`.
 *
 * WHAT THIS PROVES: each call's method, path and body, that the `data`
 * envelope is unwrapped as the server sent it, and that a 403, 409 or 422
 * reaches the caller with the server's words.
 * WHAT IT DOES NOT PROVE: who may edit or what is saved; those are the
 * backend's ChairEditInApprovalTest.
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import type { LoanApprovalEditState } from "@/types";

const STATE: LoanApprovalEditState = {
  can_edit: true,
  reason: null,
  step: { id: 41, name: "BOD Chairwoman" },
  version: "f".repeat(64),
};

type Reply = [status: number, body: unknown];

let server: Server;
const seen: { method: string; path: string; body: unknown }[] = [];
let replies: Record<string, Reply> = {};
let loanService: typeof import("./loan.service").loanService;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
      seen.push({ method: req.method ?? "", path, body: raw ? JSON.parse(raw) : null });
      const [status, body] = replies[`${req.method} ${path}`] ?? [404, { message: "not stubbed" }];
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ loanService } = await import("./loan.service"));
});

after(() => {
  server?.close();
});

beforeEach(() => {
  seen.length = 0;
  replies = {};
});

describe("loanService.approvalEditState", () => {
  test("GETs /loans/{id}/approval-edit and returns the state unwrapped", async () => {
    replies = { "GET /loans/12/approval-edit": [200, { data: STATE }] };
    assert.deepEqual(await loanService.approvalEditState(12), STATE);
    assert.deepEqual(seen, [{ method: "GET", path: "/loans/12/approval-edit", body: null }]);
  });

  test("a role without loans:edit_in_approval gets the 403", async () => {
    replies = { "GET /loans/12/approval-edit": [403, { message: "This action is unauthorized." }] };
    await assert.rejects(loanService.approvalEditState(12), (err) => httpStatusOf(err) === 403);
  });
});

describe("loanService.approvalEditPreview", () => {
  test("POSTs the form's inputs to the edit's own preview", async () => {
    const body = { loan_id: 12, principal_amount: 80000, term: 12, frequency: "semi_monthly" };
    replies = { "POST /loans/12/approval-edit/preview": [200, { data: { maturity_date: "2027-12-05" } }] };
    assert.deepEqual(await loanService.approvalEditPreview(12, body), { maturity_date: "2027-12-05" });
    assert.deepEqual(seen, [{ method: "POST", path: "/loans/12/approval-edit/preview", body }]);
  });
});

describe("loanService.approvalEdit", () => {
  const body = { version: STATE.version!, principal_amount: 80000, term: 12, frequency: "semi_monthly" };

  test("PATCHes the edit with its version and returns the saved loan", async () => {
    replies = { "PATCH /loans/12/approval-edit": [200, { message: "Loan updated.", data: { id: 12, principal_amount: 80000 } }] };
    assert.deepEqual(await loanService.approvalEdit(12, body), { id: 12, principal_amount: 80000 });
    assert.deepEqual(seen, [{ method: "PATCH", path: "/loans/12/approval-edit", body }]);
  });

  test("a stale version's 409 reaches the caller in the server's words", async () => {
    const message = "This loan changed after you opened it. Reload it to see the changes, then make your edit again.";
    replies = { "PATCH /loans/12/approval-edit": [409, { message }] };
    await assert.rejects(loanService.approvalEdit(12, body), (err) => {
      assert.equal(httpStatusOf(err), 409);
      assert.equal(getErrorMessage(err, "fallback"), message);
      return true;
    });
  });

  test("a product limit's 422 reaches the caller in the server's words", async () => {
    const message = "The term must be between 3 and 12 months for this product.";
    replies = { "PATCH /loans/12/approval-edit": [422, { message, errors: { term: [message] } }] };
    await assert.rejects(loanService.approvalEdit(12, body), (err) => {
      assert.equal(httpStatusOf(err), 422);
      assert.equal(getErrorMessage(err, "fallback"), message);
      return true;
    });
  });
});
