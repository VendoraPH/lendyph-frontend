/**
 * The loan page's "Assign / Change" account officer control, pinned at the wire.
 *
 * It used to send `PUT /loans/{id}`. The API refuses that for every loan past
 * for_review, and on a draft UpdateLoanRequest has no `account_officer_id`
 * rule, so the value was dropped while the page said "Account officer updated".
 * The API now has `PATCH /loans/{id}/account-officer`
 * (LoanController::assignAccountOfficer), which works at any status.
 *
 * WHAT THIS PROVES: the service calls that endpoint with that body, hands back
 * what the server saved, and lets a validation failure reach the caller so the
 * page can show the server's message.
 * WHAT IT DOES NOT PROVE: the controller itself. That is LoanAccountOfficerTest
 * in the backend repo.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

interface Seen {
  method: string;
  path: string;
  body: unknown;
}

let server: Server;
const seen: Seen[] = [];
let loanService: typeof import("./loan.service").loanService;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
      const body = raw ? JSON.parse(raw) : null;
      seen.push({ method: req.method ?? "", path, body });
      res.setHeader("Content-Type", "application/json");

      const officerId = (body as { account_officer_id?: number } | null)?.account_officer_id;
      if (req.method === "PATCH" && path === "/loans/7/account-officer" && officerId === 4) {
        return res.end(
          JSON.stringify({
            data: {
              id: 7,
              status: "released",
              account_officer_id: 4,
              account_officer: { id: 4, full_name: "Pedro Reyes" },
            },
          }),
        );
      }
      if (req.method === "PATCH" && path === "/loans/7/account-officer") {
        res.statusCode = 422;
        return res.end(
          JSON.stringify({
            message: "Choose an active user as the account officer.",
            errors: { account_officer_id: ["Choose an active user as the account officer."] },
          }),
        );
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "not stubbed" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ loanService } = await import("./loan.service"));
});

after(() => {
  server?.close();
});

describe("loanService.assignAccountOfficer", () => {
  test("PATCHes the dedicated endpoint, never the generic loan update", async () => {
    seen.length = 0;
    await loanService.assignAccountOfficer(7, 4);

    assert.deepEqual(seen, [
      { method: "PATCH", path: "/loans/7/account-officer", body: { account_officer_id: 4 } },
    ]);
  });

  test("returns the loan as the server saved it", async () => {
    const saved = (await loanService.assignAccountOfficer(7, 4)) as unknown as Record<string, unknown>;

    assert.equal(saved.account_officer_id, 4);
    assert.deepEqual(saved.account_officer, { id: 4, full_name: "Pedro Reyes" });
  });

  test("rejects with the server's 422 so the page can show its message", async () => {
    await assert.rejects(loanService.assignAccountOfficer(7, 999), (err: unknown) => {
      const response = (err as { response?: { status?: number; data?: { message?: string } } }).response;
      assert.equal(response?.status, 422);
      assert.equal(response?.data?.message, "Choose an active user as the account officer.");
      return true;
    });
  });
});
