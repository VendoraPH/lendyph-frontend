/**
 * The Cash In dialog's charge preview, pinned at the wire.
 *
 * The dialog used to work out the charge from the fee tiers and add it to the
 * amount in the browser. It now asks `GET /gcash/transactions/preview`, which
 * resolves the tier exactly as recording the transaction would, and only
 * displays what comes back.
 *
 * WHAT THIS PROVES: the query sent, that the `data` envelope is unwrapped, and
 * that a 422 (no tier covers the amount) reaches the caller with its
 * `errors.amount`. WHAT IT DOES NOT PROVE: the tier resolution; that is the
 * backend's GCashChargePreviewTest.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

const NO_TIER = "No tier matches amount 999999. Check the configured tier ranges.";

let server: Server;
const seen: { method: string; path: string; query: Record<string, string> }[] = [];
let gcashService: typeof import("./gcash.service").gcashService;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace(/^\/api/, "");
    const query = Object.fromEntries(url.searchParams);
    seen.push({ method: req.method ?? "", path, query });
    res.setHeader("Content-Type", "application/json");

    if (req.method === "GET" && path === "/gcash/transactions/preview") {
      if (query.amount === "999999") {
        res.statusCode = 422;
        return res.end(JSON.stringify({ message: NO_TIER, errors: { amount: [NO_TIER] } }));
      }
      return res.end(
        JSON.stringify({
          data: { type: query.type, amount: 1500.0, charge_amount: 15.0, total_amount: 1515.0 },
        }),
      );
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ message: "not stubbed" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ gcashService } = await import("./gcash.service"));
});

after(() => {
  server?.close();
});

describe("gcashService.previewCharge", () => {
  test("GETs the preview with the type and amount", async () => {
    seen.length = 0;
    await gcashService.previewCharge("cash_in", 1500);

    assert.deepEqual(seen, [
      { method: "GET", path: "/gcash/transactions/preview", query: { type: "cash_in", amount: "1500" } },
    ]);
  });

  test("returns the server's charge and total, unwrapped", async () => {
    const preview = await gcashService.previewCharge("cash_in", 1500);
    assert.deepEqual(preview, { type: "cash_in", amount: 1500, charge_amount: 15, total_amount: 1515 });
  });

  test("lets a 422 for an amount no tier covers reach the caller", async () => {
    await assert.rejects(gcashService.previewCharge("cash_in", 999999), (err: unknown) => {
      const response = (err as { response?: { status?: number; data?: { errors?: { amount?: string[] } } } })
        .response;
      assert.equal(response?.status, 422);
      assert.deepEqual(response?.data?.errors?.amount, [NO_TIER]);
      return true;
    });
  });
});
