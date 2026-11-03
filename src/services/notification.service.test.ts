/**
 * `notificationService` over real HTTP against a stub shaped like the
 * backend contract (slice N): a raw Laravel paginator for the list, the
 * `{ data: { count } }` envelope for the unread count, and two POSTs.
 *
 * The list is the one that can silently go wrong: read through `api.get` it
 * would lose `meta`, and nothing in the type would say so.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

let server: Server;
let notificationService: typeof import("./notification.service").notificationService;
let FEED_SIZE: number;
const seen: { method: string; url: string }[] = [];
let countBody: unknown = { data: { count: 3 } };

const ROW = {
  id: "9b1f6c2e-0000-4000-8000-000000000001",
  type: "loan_released",
  title: "Loan LN-2026-0007 released",
  body: "Net proceeds ₱9,250.00",
  url: "/loans/7",
  read_at: null,
  created_at: "2026-11-03T03:00:00.000Z",
  data: { loan_id: 7 },
};

before(async () => {
  server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      seen.push({ method: req.method ?? "", url: req.url ?? "" });
      res.setHeader("Content-Type", "application/json");
      const path = (req.url ?? "").split("?")[0];
      if (path === "/api/notifications" && req.method === "GET") {
        return res.end(
          JSON.stringify({
            data: [ROW],
            links: {},
            meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
          }),
        );
      }
      if (path === "/api/notifications/unread-count") {
        return res.end(JSON.stringify(countBody));
      }
      if (req.method === "POST" && path === `/api/notifications/${ROW.id}/read`) {
        return res.end(JSON.stringify({ data: { ...ROW, read_at: "2026-11-03T04:00:00.000Z" } }));
      }
      if (req.method === "POST" && path === "/api/notifications/read-all") {
        return res.end(JSON.stringify({ data: { updated: 1 } }));
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "Not Found" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  const mod = await import("./notification.service");
  notificationService = mod.notificationService;
  FEED_SIZE = mod.NOTIFICATION_FEED_SIZE;
});

after(() => {
  server?.close();
});

test("the list keeps meta and asks for the latest 20", async () => {
  const res = await notificationService.list({ per_page: FEED_SIZE });
  assert.equal(res.data.length, 1);
  assert.equal(res.data[0].body, "Net proceeds ₱9,250.00");
  assert.equal(res.meta.total, 1);
  const url = new URL(seen.at(-1)!.url, "http://x");
  assert.equal(url.searchParams.get("per_page"), "20");
  assert.equal(url.searchParams.has("unread"), false);
});

test("unread=1 is sent only when asked", async () => {
  await notificationService.list({ unread: true, per_page: FEED_SIZE });
  assert.equal(new URL(seen.at(-1)!.url, "http://x").searchParams.get("unread"), "1");
});

test("the unread count unwraps to a number", async () => {
  countBody = { data: { count: 3 } };
  assert.equal(await notificationService.unreadCount(), 3);
  assert.equal(seen.at(-1)!.url, "/api/notifications/unread-count");
});

test("an unreadable unread count rejects instead of showing a wrong badge", async () => {
  countBody = { data: { count: "lots" } };
  await assert.rejects(() => notificationService.unreadCount());
  countBody = { data: {} };
  await assert.rejects(() => notificationService.unreadCount());
  countBody = { data: { count: 3 } };
});

test("marking one read posts to its own id", async () => {
  await notificationService.markRead(ROW.id);
  assert.deepEqual(seen.at(-1), { method: "POST", url: `/api/notifications/${ROW.id}/read` });
});

test("marking all read posts to read-all", async () => {
  await notificationService.markAllRead();
  assert.deepEqual(seen.at(-1), { method: "POST", url: "/api/notifications/read-all" });
});

test("another user's id is a 404 and rejects", async () => {
  await assert.rejects(() => notificationService.markRead("someone-elses-id"));
});
