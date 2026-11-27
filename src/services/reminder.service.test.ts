/**
 * `reminderService` over real HTTP against a stub shaped like the contract in
 * `@/types/reminder`: enveloped `{success, data}` bodies for single resources,
 * raw Laravel paginators for the queue and history.
 *
 * The paginated pair is the one that can silently go wrong: read through
 * `api.get` they would lose `meta`, and the queue's status tabs (built from
 * `meta.stats`) would count nothing.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

let server: Server;
let reminderService: typeof import("./reminder.service").reminderService;
const seen: { method: string; url: string; body: string }[] = [];

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method ?? "", url: req.url ?? "", body });
      res.setHeader("Content-Type", "application/json");
      const path = (req.url ?? "").split("?")[0];
      if (path === "/api/reminders/queue") {
        return res.end(
          JSON.stringify({
            data: [{ id: 1, status: "scheduled" }],
            links: {},
            meta: { current_page: 1, last_page: 1, per_page: 100, total: 1, stats: { scheduled: 1, cancelled: 4 } },
          }),
        );
      }
      if (path === "/api/reminders/dashboard") {
        return res.end(JSON.stringify({ success: true, data: { counts: { today: 7 } } }));
      }
      if (path === "/api/reminders/pause" && req.method === "POST") {
        return res.end(JSON.stringify({ success: true, data: { id: 9, ...JSON.parse(body) } }));
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "Not Found" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  reminderService = (await import("./reminder.service")).reminderService;
});

after(() => {
  server?.close();
});

test("the queue keeps meta.stats and asks for the largest page", async () => {
  const res = await reminderService.listQueue({ status: "scheduled" });
  assert.equal(res.data.length, 1);
  assert.deepEqual(res.meta.stats, { scheduled: 1, cancelled: 4 });
  const url = new URL(seen.at(-1)!.url, "http://x");
  assert.equal(url.searchParams.get("per_page"), "100");
  assert.equal(url.searchParams.get("status"), "scheduled");
});

test("a caller's per_page overrides the default", async () => {
  await reminderService.listQueue({ per_page: 25 });
  assert.equal(new URL(seen.at(-1)!.url, "http://x").searchParams.get("per_page"), "25");
});

test("the dashboard unwraps the envelope", async () => {
  const dash = await reminderService.getDashboard();
  assert.equal(dash.counts.today, 7);
});

test("pause posts its scope and reason", async () => {
  const pause = await reminderService.pause({ scope: "loan", loan_id: 42, reason: "Restructuring" });
  assert.equal(pause.loan_id, 42);
  assert.deepEqual(JSON.parse(seen.at(-1)!.body), { scope: "loan", loan_id: 42, reason: "Restructuring" });
});

test("an unbuilt endpoint rejects with its 404, so screens can show 'not connected yet'", async () => {
  await assert.rejects(reminderService.getSettings(), (err: { response?: { status?: number } }) => {
    assert.equal(err.response?.status, 404);
    return true;
  });
});
