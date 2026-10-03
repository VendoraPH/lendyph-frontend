/**
 * The sidebar's "loans awaiting approval" badge, pinned at the wire.
 *
 * It used to count every loan in For Approval. `GET /loans` now takes
 * `awaiting_me=1`, which keeps only the for_review loans whose current pending
 * approval step belongs to one of the signed-in user's roles, so the badge
 * counts what is waiting on THIS user.
 *
 * WHAT THIS PROVES: the query the badge sends, and that the count is read off
 * `meta.total` (null when the server sends none, so the badge keeps its last
 * figure). WHAT IT DOES NOT PROVE: the filter itself; that is the backend's.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

let server: Server;
const seen: { path: string; query: Record<string, string> }[] = [];
let withTotal = true;
let loanService: typeof import("./loan.service").loanService;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    seen.push({
      path: url.pathname.replace(/^\/api/, ""),
      query: Object.fromEntries(url.searchParams),
    });
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        withTotal
          ? { data: [{ id: 1 }], meta: { current_page: 1, last_page: 3, per_page: 1, total: 3 } }
          : { data: [] },
      ),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ loanService } = await import("./loan.service"));
});

after(() => {
  server?.close();
});

describe("loanService.countAwaitingMyApproval", () => {
  test("asks for for_review loans awaiting the signed-in user's role, one row per page", async () => {
    seen.length = 0;
    withTotal = true;
    await loanService.countAwaitingMyApproval();

    assert.deepEqual(seen, [
      { path: "/loans", query: { status: "for_review", awaiting_me: "1", per_page: "1" } },
    ]);
  });

  test("returns meta.total, the count for the whole filtered query", async () => {
    withTotal = true;
    assert.equal(await loanService.countAwaitingMyApproval(), 3);
  });

  test("returns null when the server sends no total", async () => {
    withTotal = false;
    assert.equal(await loanService.countAwaitingMyApproval(), null);
  });
});
