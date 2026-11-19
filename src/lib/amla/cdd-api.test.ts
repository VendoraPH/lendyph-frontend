/**
 * `amlaCddApi` over real HTTP against a stub shaped like lendyph-backend's
 * AMLA-B4 routes (`routes/api/amla/cdd.php`).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

let server: Server;
let seen: { method?: string; url?: string; body?: unknown }[] = [];
let amlaCddApi: typeof import("./cdd-api").amlaCddApi;

const META = { current_page: 1, per_page: 25, total: 1, last_page: 1 };

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, body: raw ? JSON.parse(raw) : undefined });
      res.setHeader("Content-Type", "application/json");
      if ((req.url ?? "").startsWith("/api/amla/cdd/subjects")) {
        return res.end(JSON.stringify({ success: true, data: [{ id: 7 }], meta: META }));
      }
      return res.end(JSON.stringify({ success: true, data: { ok: true } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  amlaCddApi = (await import("./cdd-api")).amlaCddApi;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("the worklist sends only the filters set, and keeps its page meta", async () => {
  seen = [];
  const page = await amlaCddApi.worklist({ type: "walk_in", status: "", search: " juan ", branchId: undefined, page: 2 });
  assert.equal(seen[0].url, "/api/amla/cdd/subjects?type=walk_in&search=juan&page=2");
  assert.deepEqual(page, { data: [{ id: 7 }], meta: META });
  await amlaCddApi.worklist({ type: "", status: "review_overdue", search: "", branchId: 3, page: 1 });
  assert.equal(seen[1].url, "/api/amla/cdd/subjects?status=review_overdue&branch_id=3&page=1");
});

test("a subject's reads and writes go to its own routes", async () => {
  seen = [];
  const member = { segment: "members", id: 7 } as const;
  const walkIn = { segment: "walk-ins", id: 4 } as const;
  await amlaCddApi.show(member);
  await amlaCddApi.update(member, { occupation: "Teacher" });
  await amlaCddApi.verifyId(member, { document_id: 10, method: "original_seen", result: "verified" });
  await amlaCddApi.assess(walkIn, {});
  await amlaCddApi.review(walkIn, { kind: "periodic", outcome: "no_change" });
  assert.deepEqual(seen, [
    { method: "GET", url: "/api/amla/cdd/members/7", body: undefined },
    { method: "PUT", url: "/api/amla/cdd/members/7", body: { occupation: "Teacher" } },
    { method: "POST", url: "/api/amla/cdd/members/7/id-verifications", body: { document_id: 10, method: "original_seen", result: "verified" } },
    { method: "POST", url: "/api/amla/cdd/walk-ins/4/risk-assessments", body: {} },
    { method: "POST", url: "/api/amla/cdd/walk-ins/4/reviews", body: { kind: "periodic", outcome: "no_change" } },
  ]);
});
