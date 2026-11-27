/**
 * The loan form's preview, pinned at the wire.
 *
 * The form used to total the collateral, work out the security status and the
 * shortfall, and build the amortization schedule in the browser. It now posts
 * its inputs to `POST /loans/preview` and only displays what comes back.
 *
 * The pledge value is the server's (decision 11a): the loan form and the
 * restructure page name each collateral by id with the member it belongs to,
 * an edit names its loan, and a restructure names its source loan so the
 * server states the shortfall (decision 8a). Both pages post through
 * `loanService.preview`.
 *
 * WHAT THIS PROVES: the body posted, with no `snapshot_value`, that the `data`
 * envelope is unwrapped with every figure (`restructure` included) as the
 * server sent it, and that a 403 or 422 reaches the caller.
 * WHAT IT DOES NOT PROVE: the figures; those are the backend's preview tests.
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { httpStatusOf } from "@/lib/api-error";
import type { LoanFormPreview } from "@/types";

const PREVIEW: LoanFormPreview = {
  maturity_date: "2027-10-03",
  deductions: {
    items: [{ name: "Processing Fee", amount: 750, type: "percentage", original_value: 1.5 }],
    stated_total: 750,
    configured_fees: [{ fee_id: 3, name: "CI Fee", amount: 100, type: "fixed", original_value: 100 }],
    configured_total: 100,
    total_deductions: 850,
    net_proceeds: 49150,
    error: null,
  },
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
    collaterals: [{ collateral_id: 7 }],
    deductions: [
      { name: "Processing Fee", amount: 1.5, type: "percentage" as const },
      { name: "Notarial", amount: 250.5, type: "fixed" as const },
    ],
  };

  test("POSTs the form's inputs to /loans/preview", async () => {
    await loanService.preview(body);
    assert.deepEqual(seen, [{ method: "POST", path: "/loans/preview", body }]);
  });

  test("returns the server's figures, unwrapped and untouched", async () => {
    assert.deepEqual(await loanService.preview(body), PREVIEW);
  });

  test("passes a null amortization, maturity date and deductions through", async () => {
    reply = [200, { data: { ...PREVIEW, amortization: null, maturity_date: null, deductions: null } }];
    const preview = await loanService.preview({ collaterals: [] });
    assert.equal(preview.amortization, null);
    assert.equal(preview.maturity_date, null);
    assert.equal(preview.deductions, null);
  });

  test("passes the deductions guard through in the 200 body, with no net proceeds", async () => {
    const deductions = {
      ...PREVIEW.deductions!,
      net_proceeds: null,
      error: "Total deductions exceed the principal amount.",
    };
    reply = [200, { data: { ...PREVIEW, deductions } }];
    assert.deepEqual((await loanService.preview(body)).deductions, deductions);
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

describe("loanService.preview for the loan form's edit mode and the restructure page", () => {
  const restructure = {
    restructurable_balance: 70800,
    principal: 50000,
    shortfall: 20800,
    remarks_required: true,
    write_off_permission_required: true,
  };
  const restructureBody = {
    borrower_id: 11,
    source_loan_id: 40,
    loan_product_id: 3,
    principal_amount: 50000,
    collaterals: [{ collateral_id: 7 }, { collateral_id: 8 }],
  };

  test("POSTs the member, the source loan and the collateral ids, no snapshot_value", async () => {
    await loanService.preview(restructureBody);
    assert.deepEqual(seen, [{ method: "POST", path: "/loans/preview", body: restructureBody }]);
    assert.equal(JSON.stringify(seen[0].body).includes("snapshot_value"), false);
  });

  test("POSTs an edit's loan_id with the member and the collateral ids, no snapshot_value", async () => {
    const editBody = { borrower_id: 11, loan_id: 7, loan_product_id: 3, collaterals: [{ collateral_id: 9 }] };
    await loanService.preview(editBody);
    assert.deepEqual(seen, [{ method: "POST", path: "/loans/preview", body: editBody }]);
    assert.equal(JSON.stringify(seen[0].body).includes("snapshot_value"), false);
  });

  test("returns data.restructure unwrapped and untouched", async () => {
    reply = [200, { data: { ...PREVIEW, restructure } }];
    const preview = await loanService.preview(restructureBody);
    assert.deepEqual(preview, { ...PREVIEW, restructure });
    assert.deepEqual(preview.restructure, restructure);
  });

  test("passes a cancelled preview's abort to the caller", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(loanService.preview(restructureBody, controller.signal));
    assert.equal(seen.length, 0);
  });
});
