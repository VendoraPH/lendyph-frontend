/**
 * The loan Ledger, pinned at the wire.
 *
 * WHAT THIS PROVES: `loanService.ledger(id)` asks GET /loans/{id}/ledger and
 * returns the rows and closing balances as the server sent them, unwrapped
 * from the `data` envelope, and a 403 reaches the caller.
 * WHAT IT DOES NOT PROVE: the figures; those are the backend's ledger tests.
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { httpStatusOf } from "@/lib/api-error";
import type { LoanLedger } from "@/types/loan";

const LEDGER: LoanLedger = {
  rows: [
    {
      date: "2026-01-15",
      kind: "release",
      repayment_id: null,
      loan_adjustment_id: null,
      description: "Loan released",
      principal: 60000,
      interest: 10800,
      penalty: 0,
      insurance: 0,
      scb: 600,
      balances: { principal: 60000, interest: 10800, penalty: 0, scb: 600 },
    },
    {
      date: "2026-02-20",
      kind: "penalty_charge",
      repayment_id: null,
      loan_adjustment_id: null,
      description: "Late penalty, period 1",
      principal: 0,
      interest: 0,
      penalty: 236,
      insurance: 0,
      scb: 0,
      balances: { principal: 60000, interest: 10800, penalty: 236, scb: 600 },
    },
  ],
  closing: { principal: 60000, interest: 10800, penalty: 236, scb: 600 },
};

type Reply = [status: number, body: unknown];

let server: Server;
const seen: { method: string; path: string }[] = [];
let reply: Reply = [200, { data: LEDGER }];
let loanService: typeof import("./loan.service").loanService;

before(async () => {
  server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
    seen.push({ method: req.method ?? "", path });
    const [status, body] =
      req.method === "GET" && path === "/loans/12/ledger" ? reply : [404, { message: "not stubbed" }];
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
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
  reply = [200, { data: LEDGER }];
});

describe("loanService.ledger", () => {
  test("GETs /loans/{id}/ledger and returns the server's rows and closing, untouched", async () => {
    assert.deepEqual(await loanService.ledger(12), LEDGER);
    assert.deepEqual(seen, [{ method: "GET", path: "/loans/12/ledger" }]);
  });

  test("a 403 reaches the caller", async () => {
    reply = [403, { message: "This action is unauthorized." }];
    await assert.rejects(loanService.ledger(12), (err) => httpStatusOf(err) === 403);
  });
});
