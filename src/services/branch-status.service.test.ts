/**
 * The Branches page's status action, driven over REAL HTTP against a stub that
 * mirrors the sibling repo's MB-BE1 (`UpdateBranchRequest`,
 * `ChangeBranchStatusRequest`, `BranchStatusRequest` and `BranchStatus`).
 *
 * MB-BE1 makes `PUT /branches/{id}` refuse a changed `is_active` (422), which
 * is what the old Activate/Deactivate button sent. The status action replaces
 * it: `PATCH /branches/{id}/status` with a status and a required reason.
 *
 * WHAT THIS PROVES: the client sends the status change where MB-BE1 takes it,
 * with the reason, never through the edit; and the server's refusals reach the
 * page in its own words.
 * WHAT IT DOES NOT PROVE: that the real controllers behave as written. That is
 * BranchCoreTest in the backend repo; the stub is only as honest as the source
 * it was read from.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { getErrorMessage } from "@/lib/api-error";

// ── The contract, mirrored from the sibling repo ────────────────────────────

/** UpdateBranchRequest::STATUS_ELSEWHERE. */
const STATUS_ELSEWHERE = "Change a branch's status from its Status action.";
/** BranchStatusRequest::REFUSAL. */
const REFUSAL =
  "Changing a branch's status needs the branch management permission and access to all branches.";
/** BranchStatus::change() on the main office. */
const MAIN_OFFICE_STAYS = "The main office stays active. Make another branch the main office first.";

interface Row {
  id: number;
  name: string;
  code: string;
  status: "active" | "suspended" | "closed";
  is_main_office: boolean;
}

function resource(row: Row) {
  return { ...row, is_active: row.status === "active" };
}

// ── Harness ────────────────────────────────────────────────────────────────

let server: Server;
let rows: Row[] = [];
let requests: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
/** Whether the caller holds branches:manage plus branches:view_all. */
let mayManage = true;

let branchService: typeof import("./branch.service").branchService;

function reply(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const path = url.pathname.replace(/^\/api/, "");
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      requests.push({ method: req.method ?? "", path, body });
      res.setHeader("Content-Type", "application/json");

      const edit = path.match(/^\/branches\/(\d+)$/);
      const status = path.match(/^\/branches\/(\d+)\/status$/);
      const row = rows.find((r) => r.id === Number((edit ?? status)?.[1]));
      if (!row) return reply(res, 404, { message: "Not found." });

      if (edit && req.method === "PUT") {
        // `is_active` may only be sent back unchanged.
        if ("is_active" in body && body.is_active !== (row.status === "active")) {
          return reply(res, 422, { message: STATUS_ELSEWHERE, errors: { is_active: [STATUS_ELSEWHERE] } });
        }
        return reply(res, 200, { data: resource(row) });
      }

      if (status && req.method === "PATCH") {
        if (!mayManage) return reply(res, 403, { message: REFUSAL });
        const errors: Record<string, string[]> = {};
        if (body.status !== "active" && body.status !== "suspended") {
          errors.status = ["Choose active or suspended. A branch is closed through a closure request."];
        }
        if (typeof body.reason !== "string" || body.reason.trim() === "") {
          errors.reason = ["The reason field is required."];
        }
        if (Object.keys(errors).length > 0) {
          return reply(res, 422, { message: Object.values(errors)[0][0], errors });
        }
        if (row.is_main_office && body.status === "suspended") {
          return reply(res, 422, { message: MAIN_OFFICE_STAYS, errors: { status: [MAIN_OFFICE_STAYS] } });
        }
        row.status = body.status as Row["status"];
        return reply(res, 200, { data: resource(row) });
      }

      return reply(res, 404, { message: "not stubbed" });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ branchService } = await import("./branch.service"));
});

after(() => {
  server?.close();
});

function seed() {
  rows = [
    { id: 1, name: "Main Branch", code: "MAIN", status: "active", is_main_office: true },
    { id: 2, name: "North", code: "NO", status: "active", is_main_office: false },
    { id: 3, name: "South", code: "SO", status: "suspended", is_main_office: false },
  ];
  requests = [];
  mayManage = true;
}

describe("branchService.changeStatus", () => {
  test("suspends through PATCH /branches/{id}/status with the reason", async () => {
    seed();
    const branch = await branchService.changeStatus(2, { status: "suspended", reason: "Typhoon damage" });

    assert.deepEqual(requests, [
      { method: "PATCH", path: "/branches/2/status", body: { status: "suspended", reason: "Typhoon damage" } },
    ]);
    assert.equal(branch.status, "suspended");
    assert.equal(branch.is_active, false);
  });

  test("reactivates the same way", async () => {
    seed();
    const branch = await branchService.changeStatus(3, { status: "active", reason: "Repairs done" });

    assert.equal(requests[0].path, "/branches/3/status");
    assert.equal(branch.status, "active");
  });

  test("the server's refusal reaches the page in its own words", async () => {
    seed();
    const mainOffice = await branchService.changeStatus(1, { status: "suspended", reason: "x" }).catch((e) => e);
    assert.equal(getErrorMessage(mainOffice, "fallback"), MAIN_OFFICE_STAYS);

    mayManage = false;
    const refused = await branchService.changeStatus(2, { status: "suspended", reason: "x" }).catch((e) => e);
    assert.equal(getErrorMessage(refused, "fallback"), REFUSAL);
  });
});

describe("branchService.update", () => {
  test("the edit never carries is_active, so MB-BE1 never refuses it", async () => {
    seed();
    await branchService.update(3, { name: "South Office", code: "SO" });

    assert.equal(requests[0].method, "PUT");
    assert.equal("is_active" in requests[0].body, false);
  });
});
