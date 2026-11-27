/**
 * `collateralService.attachToLoan`, pinned at the wire.
 *
 * The browser used to send the value a collateral was pledged at, and the
 * server stored it as sent. The server now sets the pledge value itself
 * (decision 11a), so the attach names the collateral and nothing else.
 *
 * WHAT THIS PROVES: one POST to the loan's collaterals with `collateral_id`
 * only, and the server's link row (its pivot value) handed back untouched.
 * WHAT IT DOES NOT PROVE: the value the server pledges; that is the backend's
 * CollateralSnapshotValueTest.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { LoanCollateral } from "../types";

const LINK: LoanCollateral = {
  id: 4,
  borrower_id: 3,
  collateral_type_id: 1,
  detail_value: "TCT-4",
  amount: 250000,
  pivot: { loan_id: 7, snapshot_value: 250000, attached_at: "2026-11-02T00:00:00Z" },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

let server: Server;
const seen: { method: string; path: string; body: unknown }[] = [];
let collateralService: typeof import("./collateral.service").collateralService;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
      seen.push({ method: req.method ?? "", path, body: raw ? JSON.parse(raw) : null });
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST" && path === "/loans/7/collaterals") {
        res.statusCode = 201;
        return res.end(JSON.stringify({ data: LINK }));
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "not stubbed" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ collateralService } = await import("./collateral.service"));
});

after(() => {
  server?.close();
});

describe("collateralService.attachToLoan", () => {
  test("names the collateral only: no snapshot_value goes up", async () => {
    seen.length = 0;
    await collateralService.attachToLoan(7, 4);
    assert.deepEqual(seen, [{ method: "POST", path: "/loans/7/collaterals", body: { collateral_id: 4 } }]);
  });

  test("hands back the server's link row, its pivot value untouched", async () => {
    const link = await collateralService.attachToLoan(7, 4);
    assert.equal(link.pivot?.snapshot_value, 250000);
  });
});
