/**
 * `amlaScreeningApi` over real HTTP against a stub shaped like
 * lendyph-backend's AMLA-B5 routes (`routes/api/amla/screening.php`).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

let server: Server;
let seen: { method?: string; url?: string; body: string; key?: string; type?: string }[] = [];
let amlaScreeningApi: typeof import("./screening-api").amlaScreeningApi;

const META = { current_page: 1, per_page: 25, total: 1, last_page: 1 };

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, body: raw, key: req.headers["idempotency-key"] as string | undefined, type: req.headers["content-type"] });
      res.setHeader("Content-Type", "application/json");
      const path = (req.url ?? "").split("?")[0];
      if (req.method === "GET" && (path === "/api/amla/screening/matches" || path === "/api/amla/orders")) {
        return res.end(JSON.stringify({ success: true, data: [{ id: 1 }], meta: META }));
      }
      return res.end(JSON.stringify({ success: true, data: { ok: true } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  amlaScreeningApi = (await import("./screening-api")).amlaScreeningApi;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("the lists, an upload as a file, and a rescreen go to their routes", async () => {
  seen = [];
  await amlaScreeningApi.lists();
  await amlaScreeningApi.upload("amlc", new Blob(["reference,type\n"], { type: "text/csv" }), "designations.csv", " Resolution 12 ");
  await amlaScreeningApi.rescreen();
  assert.deepEqual(seen.map((s) => `${s.method} ${s.url}`), [
    "GET /api/amla/screening/lists",
    "POST /api/amla/screening/lists/amlc/versions",
    "POST /api/amla/screening/rescreen",
  ]);
  assert.match(seen[1].type ?? "", /^multipart\/form-data/);
  assert.match(seen[1].body, /name="file"; filename="designations.csv"/);
  assert.match(seen[1].body, /name="version_label"\r\n\r\nResolution 12\r\n/);
});

test("matches send only the filters set, keep the page meta, and are decided with a reason", async () => {
  seen = [];
  const page = await amlaScreeningApi.matches({ status: "pending", subject_type: "", page: 1 });
  assert.equal(seen[0].url, "/api/amla/screening/matches?status=pending&page=1");
  assert.deepEqual(page, { data: [{ id: 1 }], meta: META });
  await amlaScreeningApi.match(5);
  await amlaScreeningApi.confirm(5, " Same ID ");
  await amlaScreeningApi.clear(6, "Different person");
  assert.deepEqual(seen.slice(1).map((s) => [s.method, s.url, s.body]), [
    ["GET", "/api/amla/screening/matches/5", ""],
    ["POST", "/api/amla/screening/matches/5/confirm", JSON.stringify({ reason: "Same ID" })],
    ["POST", "/api/amla/screening/matches/6/clear", JSON.stringify({ reason: "Different person" })],
  ]);
});

test("recording an order carries the form's Idempotency-Key", async () => {
  seen = [];
  const body = { reference: "R", authority: "amlc", received_on: "2026-11-20", borrower_id: 7, required_action: "Freeze", holds: [] };
  await amlaScreeningApi.placeOrder(body, "0b5f6f0e-6c1a-4b7e-9f51-3a1c2d4e5f60");
  assert.equal(seen[0].url, "/api/amla/orders");
  assert.equal(seen[0].key, "0b5f6f0e-6c1a-4b7e-9f51-3a1c2d4e5f60");
  assert.deepEqual(JSON.parse(seen[0].body), body);
});

test("orders list, read and go through their release steps", async () => {
  seen = [];
  await amlaScreeningApi.orders({ status: "active", page: 2 });
  await amlaScreeningApi.order(2);
  await amlaScreeningApi.requestRelease(2, { reason: "Lifted", release_reference: "CA-1" });
  await amlaScreeningApi.approveRelease(2, "");
  await amlaScreeningApi.rejectRelease(2, " Not yet ");
  await amlaScreeningApi.withdrawRelease(2, "Asked twice");
  assert.deepEqual(seen.map((s) => [s.method, s.url, s.body]), [
    ["GET", "/api/amla/orders?status=active&page=2", ""],
    ["GET", "/api/amla/orders/2", ""],
    ["POST", "/api/amla/orders/2/release", JSON.stringify({ reason: "Lifted", release_reference: "CA-1" })],
    ["POST", "/api/amla/orders/2/release/approve", "{}"],
    ["POST", "/api/amla/orders/2/release/reject", JSON.stringify({ note: "Not yet" })],
    ["POST", "/api/amla/orders/2/release/withdraw", JSON.stringify({ note: "Asked twice" })],
  ]);
});
