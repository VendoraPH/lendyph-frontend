/**
 * The loan form's and the restructure page's preview, pinned at the wire.
 *
 * The pledge value is the server's (decision 11a): the preview names each
 * collateral by id with the member it belongs to, and the restructure page
 * names its source loan so the server states the shortfall (decision 8a).
 *
 * WHAT THIS PROVES: the body goes up as built, with no `snapshot_value`, and
 * `data.restructure` comes back to the page untouched. WHAT IT DOES NOT PROVE:
 * the figures; those are the backend's preview tests.
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { httpStatusOf } from "@/lib/api-error";
import type { FormPreview } from "./loan-preview";

const PREVIEW: FormPreview = {
  maturity_date: "2027-05-03",
  deductions: null,
  collateral: { total_value: 80000, security_status: "partially_secured", short_by: 20000 },
  amortization: null,
  restructure: {
    restructurable_balance: 70800,
    principal: 50000,
    shortfall: 20800,
    remarks_required: true,
    write_off_permission_required: true,
  },
};

type Reply = [status: number, body: unknown];

let server: Server;
const seen: { method: string; path: string; body: unknown }[] = [];
let reply: Reply = [200, { data: PREVIEW }];
let postLoanFormPreview: typeof import("./form-preview-api").postLoanFormPreview;

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
  ({ postLoanFormPreview } = await import("./form-preview-api"));
});

after(() => {
  server?.close();
});

beforeEach(() => {
  seen.length = 0;
  reply = [200, { data: PREVIEW }];
});

describe("postLoanFormPreview", () => {
  const body = {
    borrower_id: 11,
    source_loan_id: 40,
    loan_product_id: 3,
    principal_amount: 50000,
    collaterals: [{ collateral_id: 7 }, { collateral_id: 8 }],
  };

  test("POSTs the member, the source loan and the collateral ids to /loans/preview, no snapshot_value", async () => {
    await postLoanFormPreview(body);
    assert.deepEqual(seen, [{ method: "POST", path: "/loans/preview", body }]);
    assert.equal(JSON.stringify(seen[0].body).includes("snapshot_value"), false);
  });

  test("returns the server's figures, data.restructure included, unwrapped and untouched", async () => {
    const preview = await postLoanFormPreview(body);
    assert.deepEqual(preview, PREVIEW);
    assert.deepEqual(preview.restructure, PREVIEW.restructure);
  });

  test("lets a 403 and a 422 reach the caller", async () => {
    for (const status of [403, 422]) {
      reply = [status, { message: "refused" }];
      await assert.rejects(postLoanFormPreview(body), (err: unknown) => {
        assert.equal(httpStatusOf(err), status);
        return true;
      });
    }
  });
});
