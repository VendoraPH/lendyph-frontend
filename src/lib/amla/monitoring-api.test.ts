/**
 * `amlaMonitoringApi` over real HTTP against a stub shaped like
 * lendyph-backend's AMLA-B3 and B4 routes (`detection.php`, `cdd.php`).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

let server: Server;
let seen: string[] = [];
let amlaMonitoringApi: typeof import("./monitoring-api").amlaMonitoringApi;

const META = { current_page: 1, per_page: 25, total: 7, last_page: 1 };

before(async () => {
  server = createServer((req, res) => {
    seen.push(req.method === "POST" ? `POST ${req.url ?? ""}` : req.url ?? "");
    res.setHeader("Content-Type", "application/json");
    const path = (req.url ?? "").split("?")[0];
    if (path === "/api/amla/alerts" || path === "/api/amla/ctr-candidates") {
      return res.end(JSON.stringify({ success: true, data: [{ id: 1 }], meta: META }));
    }
    return res.end(JSON.stringify({ success: true, data: { ok: path } }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  amlaMonitoringApi = (await import("./monitoring-api")).amlaMonitoringApi;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("alerts send only the filters set and keep the server's page meta", async () => {
  seen = [];
  const page = await amlaMonitoringApi.alerts({ status: "open", rule: "", priority: "critical", from: "", to: "2026-11-20", search: " ALR ", branch_id: 3, page: 2 });
  assert.equal(seen[0], "/api/amla/alerts?status=open&priority=critical&branch_id=3&to=2026-11-20&search=ALR&page=2");
  assert.deepEqual(page, { data: [{ id: 1 }], meta: META });
});

test("the dashboard's lists ask for a short page", async () => {
  seen = [];
  await amlaMonitoringApi.alerts({ status: "open", rule: "", priority: "", from: "", to: "", search: "", page: 1, per_page: 10 });
  await amlaMonitoringApi.ctrCandidates({ from: "", to: "", search: "", page: 1, per_page: 10 });
  assert.deepEqual(seen, ["/api/amla/alerts?status=open&page=1&per_page=10", "/api/amla/ctr-candidates?page=1&per_page=10"]);
});

test("each record and the rules have their own route", async () => {
  seen = [];
  await amlaMonitoringApi.alert(9);
  await amlaMonitoringApi.ctrCandidate(3);
  await amlaMonitoringApi.detectionRules();
  await amlaMonitoringApi.detectionRuleVersions();
  await amlaMonitoringApi.riskRules();
  assert.deepEqual(seen, [
    "/api/amla/alerts/9",
    "/api/amla/ctr-candidates/3",
    "/api/amla/detection-rules",
    "/api/amla/detection-rules/versions",
    "/api/amla/risk-rules",
  ]);
});

test("the alert workflow posts to the alert's own routes, and its history is its own read", async () => {
  seen = [];
  await amlaMonitoringApi.assignAlert(9, 4, "");
  await amlaMonitoringApi.reviewAlert(9, "Checking");
  await amlaMonitoringApi.closeAlert(9, "Known salary");
  await amlaMonitoringApi.alertHistory(9);
  assert.deepEqual(seen, [
    "POST /api/amla/alerts/9/assign",
    "POST /api/amla/alerts/9/review",
    "POST /api/amla/alerts/9/close",
    "/api/amla/alerts/9/history",
  ]);
});
