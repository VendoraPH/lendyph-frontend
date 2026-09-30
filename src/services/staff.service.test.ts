/**
 * `staffService.list`, driven over REAL HTTP against a stub that mirrors the
 * sibling repo's `StaffController::index()` and `ListStaffRequest`.
 *
 * The Account Officer pickers read this instead of `/users`, which only admin
 * and super_admin may call. They search on the server and show one page, so
 * what matters on the wire is that the query reaches the server intact and
 * that `meta` comes back: `api.get` would unwrap the body to its rows and the
 * picker could no longer say "Showing 20 of 57".
 *
 * WHAT THIS PROVES: the client calls `/staff` with `search`, `page` and
 * `per_page`, keeps `meta`, and surfaces a 403 so the picker can tell it apart
 * from any other failure.
 * WHAT IT DOES NOT PROVE: that the real controller behaves as written. That is
 * StaffListTest in the backend repo; the stub is only as honest as the source
 * it was read from.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import {
  STAFF_PAGE_SIZE,
  isStaffListForbidden,
  normaliseStaffQuery,
  staffSearchStatus,
} from "@/lib/staff-search";

// ── The contract, mirrored from the sibling repo ────────────────────────────

interface Row {
  id: number;
  first_name: string;
  last_name: string;
  status: "active" | "inactive";
}

/** `'per_page' => ['nullable', 'integer', 'min:1']`, clamped to 1..100. Null is a 422. */
function perPageFor(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return 15;
  if (!/^\d+$/.test(raw) || Number(raw) < 1) return null;
  return Math.min(Number(raw), 100);
}

/** First name, last name, or `CONCAT(first_name, ' ', last_name)`, as a `like`. */
function matches(row: Row, search: string): boolean {
  const q = search.toLowerCase();
  return (
    row.first_name.toLowerCase().includes(q) ||
    row.last_name.toLowerCase().includes(q) ||
    `${row.first_name} ${row.last_name}`.toLowerCase().includes(q)
  );
}

function byName(a: Row, b: Row): number {
  return (
    a.first_name.localeCompare(b.first_name) ||
    a.last_name.localeCompare(b.last_name) ||
    a.id - b.id
  );
}

// ── Seed ────────────────────────────────────────────────────────────────────

/** 57 active staff, so one picker page of 20 is visibly short of the total. */
const ACTIVE = 57;

function seedStaff(): Row[] {
  const rows: Row[] = Array.from({ length: ACTIVE }, (_, i) => ({
    id: i + 1,
    first_name: `Staff${String(i + 1).padStart(2, "0")}`,
    last_name: "Reyes",
    status: "active" as const,
  }));
  rows.push({ id: 100, first_name: "Juan", last_name: "Dela Cruz", status: "active" });
  rows.push({ id: 101, first_name: "Ana", last_name: "Dela Cruz", status: "inactive" });
  return rows;
}

// ── Harness ────────────────────────────────────────────────────────────────

let server: Server;
const staff = seedStaff();
let requests: Array<{ path: string; query: Record<string, string> }> = [];
// Whether the caller holds `loans:create` or `loans:update`.
let permitted = true;

let staffService: typeof import("./staff.service").staffService;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace(/^\/api/, "");
    const query = Object.fromEntries(url.searchParams.entries());
    requests.push({ path, query });
    res.setHeader("Content-Type", "application/json");

    if (path !== "/staff") {
      res.statusCode = 404;
      return res.end(JSON.stringify({ message: "not stubbed" }));
    }
    if (!permitted) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ message: "This action is unauthorized." }));
    }
    const perPage = perPageFor(query.per_page);
    if (perPage === null || (query.search ?? "").length > 100) {
      res.statusCode = 422;
      return res.end(JSON.stringify({ message: "The given data was invalid." }));
    }

    const search = query.search ?? "";
    const rows = staff
      .filter((r) => r.status === "active")
      .filter((r) => search === "" || matches(r, search))
      .sort(byName);
    const page = Math.max(1, Number(query.page ?? 1));
    res.end(
      JSON.stringify({
        data: rows
          .slice((page - 1) * perPage, page * perPage)
          .map((r) => ({ id: r.id, full_name: `${r.first_name} ${r.last_name}` })),
        links: {},
        meta: {
          current_page: page,
          last_page: Math.max(1, Math.ceil(rows.length / perPage)),
          per_page: perPage,
          total: rows.length,
        },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ staffService } = await import("./staff.service"));
});

after(() => {
  server?.close();
});

describe("staffService.list", () => {
  test("calls /staff with search, page and per_page, and keeps meta", async () => {
    requests = [];
    const res = await staffService.list({ search: "reyes", page: 2, per_page: STAFF_PAGE_SIZE });

    assert.deepEqual(requests, [
      { path: "/staff", query: { search: "reyes", page: "2", per_page: String(STAFF_PAGE_SIZE) } },
    ]);
    assert.equal(res.data.length, STAFF_PAGE_SIZE);
    assert.deepEqual(res.meta, {
      current_page: 2,
      last_page: 3,
      per_page: STAFF_PAGE_SIZE,
      total: ACTIVE,
    });
    assert.deepEqual(Object.keys(res.data[0]).sort(), ["full_name", "id"]);
  });

  test("with no search, asks for the first page of everyone active", async () => {
    requests = [];
    const res = await staffService.list({ per_page: STAFF_PAGE_SIZE });

    assert.deepEqual(requests[0].query, { per_page: String(STAFF_PAGE_SIZE) });
    // 57 Reyes plus Juan Dela Cruz; the inactive Ana is never listed.
    assert.equal(res.meta.total, ACTIVE + 1);
    assert.equal(
      staffSearchStatus({ query: "", shown: res.data.length, total: res.meta.total, pending: false, failed: false }),
      `Showing ${STAFF_PAGE_SIZE} of ${ACTIVE + 1} — type a name to narrow.`,
    );
  });

  test("a double-spaced full name, normalised, still finds the officer", async () => {
    const res = await staffService.list({ search: normaliseStaffQuery("  juan   dela ") });

    assert.deepEqual(res.data, [{ id: 100, full_name: "Juan Dela Cruz" }]);
  });

  test("a 403 rejects, and the picker recognises it as forbidden", async () => {
    permitted = false;
    try {
      await assert.rejects(staffService.list({ per_page: STAFF_PAGE_SIZE }), (err: unknown) => {
        assert.equal(isStaffListForbidden(err), true);
        return true;
      });
    } finally {
      permitted = true;
    }
  });

  test("a 422 is a failure, not a 403", async () => {
    await assert.rejects(staffService.list({ search: "x".repeat(101) }), (err: unknown) => {
      assert.equal(isStaffListForbidden(err), false);
      return true;
    });
  });
});
