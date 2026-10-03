/**
 * The loan form's preview, pinned at the wire.
 *
 * The form used to total the collateral, work out the security status and the
 * shortfall, and build the amortization schedule in the browser. It now posts
 * its inputs to `POST /loans/preview` and only displays what comes back.
 *
 * WHAT THIS PROVES: the body posted, that the `data` envelope is unwrapped with
 * every figure as the server sent it, and that a 403 or 422 reaches the caller.
 * WHAT IT DOES NOT PROVE: the figures; those are the backend's preview tests.
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { httpStatusOf } from "@/lib/api-error";
import type { LoanFormPreview } from "@/types";

const PREVIEW: LoanFormPreview = {
  collateral: { total_value: 25000.5, security_status: "partially_secured", short_by: 24999.5 },
  amortization: {
    maturity_date: "2027-10-03",
    interest_method: "straight",
    rows: [
      {
        period_number: 1,
        due_date: "2026-11-03",
        principal_due: 4166.67,
        interest_due: 1250,
        total_due: 5416.67,
        share_capital_build_up: 100,
        total_payment: 5516.67,
        remaining_balance: 45833.33,
      },
    ],
    totals: { principal_due: 50000, interest_due: 15000, share_capital_build_up: 1200, total_payment: 66200 },
  },
};

type Reply = [status: number, body: unknown];

let server: Server;
const seen: { method: string; path: string; body: unknown }[] = [];
let reply: Reply = [200, { data: PREVIEW }];
let loanService: typeof import("./loan.service").loanService;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
      seen.push({ method: req.method ?? "", path, body: raw ? JSON.parse(raw) : null });
      const [status, body] =
        req.method === "POST" && path === "/loans/preview" ? reply : [404, { message: "not stubbed" }];
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
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

beforeEach(() => {
  seen.length = 0;
  reply = [200, { data: PREVIEW }];
});

describe("loanService.preview", () => {
  const body = {
    loan_product_id: 3,
    principal_amount: 50000,
    interest_rate: 2.5,
    term: 12,
    frequency: "monthly",
    start_date: "2026-10-03",
    scb_amount: 100,
    collaterals: [{ collateral_id: 7, snapshot_value: 25000.5 }],
  };

  test("POSTs the form's inputs to /loans/preview", async () => {
    await loanService.preview(body);
    assert.deepEqual(seen, [{ method: "POST", path: "/loans/preview", body }]);
  });

  test("returns the server's figures, unwrapped and untouched", async () => {
    assert.deepEqual(await loanService.preview(body), PREVIEW);
  });

  test("passes a null amortization through", async () => {
    reply = [200, { data: { ...PREVIEW, amortization: null } }];
    const preview = await loanService.preview({ collaterals: [] });
    assert.equal(preview.amortization, null);
  });

  test("lets a 403 and a 422 reach the caller", async () => {
    for (const status of [403, 422]) {
      reply = [status, { message: "refused" }];
      await assert.rejects(loanService.preview(body), (err: unknown) => {
        assert.equal(httpStatusOf(err), status);
        return true;
      });
    }
  });
});
