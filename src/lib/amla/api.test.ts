/**
 * `amlaApi` over real HTTP against a stub shaped like lendyph-backend's
 * AMLA-B1 routes (`routes/api/amla/foundation.php`).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

let server: Server;
let seen: { method?: string; url?: string; body?: unknown }[] = [];
let amlaApi: typeof import("./api").amlaApi;

const PAGE_META = { current_page: 2, per_page: 25, total: 30, last_page: 2 };

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, body: raw ? JSON.parse(raw) : undefined });
      res.setHeader("Content-Type", "application/json");
      const path = (req.url ?? "").split("?")[0];
      if (path === "/api/amla/change-requests" && req.method === "GET") {
        return res.end(JSON.stringify({ success: true, data: [{ id: 4 }], meta: PAGE_META }));
      }
      if (path === "/api/amla/log") {
        return res.end(JSON.stringify({ success: true, data: [{ id: 9 }], meta: { ...PAGE_META, per_page: 50 } }));
      }
      return res.end(JSON.stringify({ success: true, data: { ok: path } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  amlaApi = (await import("./api")).amlaApi;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const last = () => seen[seen.length - 1];

test("the reads go to the AMLA foundation routes", async () => {
  seen = [];
  await amlaApi.status();
  await amlaApi.settings();
  await amlaApi.settingsVersions();
  await amlaApi.calendar(2027);
  await amlaApi.calendar(null);
  await amlaApi.deadlinePreview("str", "2026-11-19");
  assert.deepEqual(
    seen.map((s) => s.url),
    [
      "/api/amla/status",
      "/api/amla/settings",
      "/api/amla/settings/versions",
      "/api/amla/calendar?year=2027",
      "/api/amla/calendar",
      "/api/amla/deadlines/preview?kind=str&from=2026-11-19",
    ],
  );
});

test("change requests keep the page meta and send only the filters set", async () => {
  const page = await amlaApi.changeRequests({ status: "pending", page: 2 });
  assert.equal(last().url, "/api/amla/change-requests?status=pending&page=2");
  assert.deepEqual(page, { data: [{ id: 4 }], meta: PAGE_META });
  await amlaApi.changeRequests({ status: null, page: 1 });
  assert.equal(last().url, "/api/amla/change-requests?page=1");
  await amlaApi.changeRequests({ status: "pending", type: "detection_rules", page: 1 });
  assert.equal(last().url, "/api/amla/change-requests?status=pending&type=detection_rules&page=1");
});

test("asking, approving, rejecting and withdrawing post to their own routes", async () => {
  seen = [];
  await amlaApi.ask({ type: "calendar_confirm_year", year: 2027, reason: "Official list" });
  await amlaApi.approve(4, "");
  await amlaApi.reject(4, "Wrong source");
  await amlaApi.withdraw(5, "Asked twice");
  assert.deepEqual(seen, [
    { method: "POST", url: "/api/amla/change-requests", body: { type: "calendar_confirm_year", year: 2027, reason: "Official list" } },
    { method: "POST", url: "/api/amla/change-requests/4/approve", body: {} },
    { method: "POST", url: "/api/amla/change-requests/4/reject", body: { note: "Wrong source" } },
    { method: "POST", url: "/api/amla/change-requests/5/withdraw", body: { note: "Asked twice" } },
  ]);
});

test("the AMLA log keeps its page meta and sends only the filters set", async () => {
  const page = await amlaApi.log({ action: "change_approved", from: "2026-11-01", to: "", page: 1 });
  assert.equal(last().url, "/api/amla/log?action=change_approved&from=2026-11-01&page=1");
  assert.equal(page.meta.per_page, 50);
  assert.deepEqual(page.data, [{ id: 9 }]);
});
