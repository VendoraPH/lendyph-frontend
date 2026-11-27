/**
 * Forwarding a loan's next approval step to a named user, pinned at the wire.
 *
 * WHAT THIS PROVES: what submit and approve send with and without a pick, the
 * candidates read, and the awaiting-me count's query. WHAT IT DOES NOT PROVE:
 * who may be picked or who may act; that is the backend's
 * (LoanApprovalChainService and ApprovalAssignees).
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
let loanApprovalService: typeof import("./loan-approval.service").loanApprovalService;

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
  ({ loanApprovalService } = await import("./loan-approval.service"));
});

after(() => {
  server?.close();
});

beforeEach(() => {
  seen.length = 0;
  reply = { data: {} };
});

describe("submitting a draft", () => {
  test("without a pick it sends an empty body to the submit route", async () => {
    await loanApprovalService.submit(12);
    assert.deepEqual(seen, [{ method: "PATCH", path: "/loans/12/submit", query: {}, body: {} }]);
  });

  test("with a pick it sends forward_to_user_id", async () => {
    await loanApprovalService.submit(12, { forward_to_user_id: 7 });
    assert.deepEqual(seen[0].body, { forward_to_user_id: 7 });
  });
});

describe("approving a step", () => {
  test("without a pick it sends the remarks and names the step it acts on", async () => {
    await loanApprovalService.approve(12, 41, { remarks: "Looks fine" });
    assert.deepEqual(seen, [
      {
        method: "PATCH",
        path: "/loans/12/approval-steps/41/approve",
        query: {},
        body: { remarks: "Looks fine", step_id: 41 },
      },
    ]);
  });

  test("with a pick it sends forward_to_user_id beside the remarks", async () => {
    await loanApprovalService.approve(12, 41, { remarks: "Looks fine", forward_to_user_id: 9 });
    assert.deepEqual(seen[0].body, { remarks: "Looks fine", forward_to_user_id: 9, step_id: 41 });
  });

  test("with no payload it still names the step", async () => {
    await loanApprovalService.approve(12, 41);
    assert.deepEqual(seen[0].body, { step_id: 41 });
  });
});

describe("sending a step back", () => {
  test("names the step it acts on beside the target and the reason", async () => {
    await loanApprovalService.sendBack(12, 41, { target_step_order: 1, remarks: "Missing ID" });
    assert.deepEqual(seen, [
      {
        method: "PATCH",
        path: "/loans/12/approval-steps/41/send-back",
        query: {},
        body: { target_step_order: 1, remarks: "Missing ID", step_id: 41 },
      },
    ]);
  });
});

describe("the forward candidates", () => {
  test("reads GET /loans/{loan}/approval/forward-candidates and answers its data", async () => {
    reply = {
      data: {
        next_step: { name: "Manager", role: "manager", role_label: "Manager", kind: "approve" },
        users: [{ id: 7, name: "Ana Cruz" }],
      },
    };
    const result = await loanApprovalService.forwardCandidates(12);
    assert.deepEqual(seen.map((s) => [s.method, s.path]), [["GET", "/loans/12/approval/forward-candidates"]]);
    assert.deepEqual(result, {
      next_step: { name: "Manager", role: "manager", role_label: "Manager", kind: "approve" },
      users: [{ id: 7, name: "Ana Cruz" }],
    });
  });
});

describe("the awaiting-me count", () => {
  test("asks for loans for approval and approved loans waiting at release, one row per page", async () => {
    reply = { data: [{ id: 1 }], meta: { current_page: 1, last_page: 4, per_page: 1, total: 4 } };
    assert.equal(await loanApprovalService.countAwaitingMe(), 4);
    assert.deepEqual(seen.map((s) => [s.path, s.query]), [
      ["/loans", { status: "for_review,approved", awaiting_me: "1", per_page: "1" }],
    ]);
  });

  test("answers null when the server sends no total", async () => {
    reply = { data: [] };
    assert.equal(await loanApprovalService.countAwaitingMe(), null);
  });
});
