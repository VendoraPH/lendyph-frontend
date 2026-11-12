/**
 * The BINHS page's two calls, driven over real HTTP against a stub of
 * `BinhsCalculatorController` (backend B1): what the page asks, and that it
 * reads the answer as the server sent it.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { BinhsResult } from "@/lib/binhs";

const SCENARIO = {
  rows: [
    {
      period: 1,
      due_date: "2026-08-07",
      principal: "3268.85",
      interest: "200.00",
      penalty: "0.00",
      scbu: "100.00",
      total_payment: "3568.85",
      running_balance: "6731.15",
    },
  ],
  totals: { principal: "3268.85", interest: "200.00", penalty: "0.00", scbu: "100.00", total_payment: "3568.85" },
};

const requests: { method: string; path: string; body: unknown }[] = [];
let server: Server;
let calculate: typeof import("./binhs-api").calculateBinhs;
let prefill: typeof import("./binhs-api").binhsPrefill;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
      const body = raw ? JSON.parse(raw) : null;
      requests.push({ method: req.method ?? "", path, body });
      res.setHeader("Content-Type", "application/json");
      const loanOnly = body && Object.keys(body).length === 1 && "loan_id" in body;
      res.end(
        JSON.stringify({
          data: loanOnly
            ? {
                prefill: { loan_id: 9, principal: "50000.00", annual_rate: "36", term_months: 12, start_date: "2026-09-15" },
                scenarios: null,
              }
            : { prefill: null, scenarios: { ideal: SCENARIO, worst_case: SCENARIO, custom: SCENARIO } },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  const mod = await import("./binhs-api");
  calculate = mod.calculateBinhs;
  prefill = mod.binhsPrefill;
});

after(() => {
  server.close();
});

test("the schedules come from POST /loans/amortization-calculator/binhs, as sent", async () => {
  requests.length = 0;
  const body = {
    principal: "10000",
    annual_rate: "24",
    term_months: 3,
    start_date: "2026-08-07",
    scbu_per_period: "100",
    paid_flags: [true, false, false],
  };
  const result: BinhsResult = await calculate(body);

  assert.deepEqual(requests, [{ method: "POST", path: "/loans/amortization-calculator/binhs", body }]);
  assert.deepEqual(result.scenarios?.ideal, SCENARIO);
  assert.deepEqual(result.scenarios?.custom.totals, SCENARIO.totals);
});

test("the ?loan_id prefill sends the loan alone and reads the server's prefill", async () => {
  requests.length = 0;
  const result = await prefill(9);

  assert.deepEqual(requests, [{ method: "POST", path: "/loans/amortization-calculator/binhs", body: { loan_id: 9 } }]);
  assert.deepEqual(result, { loan_id: 9, principal: "50000.00", annual_rate: "36", term_months: 12, start_date: "2026-09-15" });
});
