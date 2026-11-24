/**
 * A user's chosen primary branch and branch history (Phase 6 MB-BE6), pinned
 * at the wire.
 *
 * WHAT THIS PROVES: the history's route and paging, that its whole paginator
 * body reaches the screen, and that create and update carry
 * `primary_branch_id` (null for Organisation-wide). WHAT IT DOES NOT PROVE:
 * who may read the history or which primary branch is allowed; that is the
 * backend's (UserBranchHistoryRequest, ResolvesBranchAssignment).
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

interface Seen {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
}

let server: Server;
const seen: Seen[] = [];
let reply: unknown = { data: {} };
let userService: typeof import("./user.service").userService;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      seen.push({
        method: req.method ?? "",
        path: url.pathname.replace(/^\/api/, ""),
        query: Object.fromEntries(url.searchParams),
        body: raw === "" ? null : JSON.parse(raw),
      });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(reply));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ userService } = await import("./user.service"));
});

after(() => {
  server?.close();
});

beforeEach(() => {
  seen.length = 0;
  reply = { data: {} };
});

describe("a user's branch history", () => {
  test("reads one page from the user's own route, newest first as the server orders it", async () => {
    await userService.branchHistory(7, { page: 2, per_page: 25 });
    assert.deepEqual(seen, [
      { method: "GET", path: "/users/7/branch-history", query: { page: "2", per_page: "25" }, body: null },
    ]);
  });

  test("hands the screen the whole paginator body, meta included", async () => {
    const entry = {
      id: 5,
      kind: "primary",
      from: "North",
      to: "Organisation-wide",
      description: "Primary branch changed from North to Organisation-wide.",
      by: "Ana Cruz",
      at: "2026-11-24T01:30:00.000000Z",
    };
    reply = { data: [entry], meta: { current_page: 1, last_page: 3, per_page: 25, total: 60 } };
    const page = await userService.branchHistory(7, { page: 1, per_page: 25 });
    assert.deepEqual(page.data, [entry]);
    assert.equal(page.meta.total, 60);
  });
});

describe("the chosen primary branch", () => {
  test("create sends it beside the branches", async () => {
    await userService.create({
      first_name: "Ana",
      last_name: "Cruz",
      username: "acruz",
      email: "ana@coop.ph",
      password: "password123",
      password_confirmation: "password123",
      branch_ids: [3, 9],
      branch_id: 3,
      primary_branch_id: 9,
      role: "loan_officer",
    });
    assert.equal(seen[0].method, "POST");
    assert.equal(seen[0].path, "/users");
    assert.equal((seen[0].body as { primary_branch_id: unknown }).primary_branch_id, 9);
  });

  test("update sends Organisation-wide as null, not as a missing key", async () => {
    await userService.update(7, { primary_branch_id: null });
    assert.deepEqual(seen, [{ method: "PUT", path: "/users/7", query: {}, body: { primary_branch_id: null } }]);
  });
});
