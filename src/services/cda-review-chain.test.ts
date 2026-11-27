/**
 * The CDA review chain and custom requirements at the wire (backend B6).
 *
 * WHAT THIS PROVES: approve on a chain names its step (`step_id`); a stale
 * step (409) and a missing one (422 under `errors.step_id`) reload the report
 * and read as the server's sentence; a requirement is deleted with one
 * DELETE, and its refusal reads in words.
 * WHAT IT DOES NOT PROVE: who may approve or delete; that is the backend's
 * CdaReviewChainTest and CdaComplianceRequirementsTest.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { CdaApprovalStep } from "../types/cda";
import { approveInput, reloadsReport } from "../app/(app)/cda/_lib/review-chain";
import { cdaErrorMessage } from "../app/(app)/cda/_lib/refusals";

const STALE = "That review step isn't waiting for approval any more: the report is now at the \"Board review\" step. Reload it to see where it stands.";
const MISSING = "Say which review step you are approving: the report is at the \"Board review\" step.";

let server: Server;
const seen: { method: string; path: string; body: unknown }[] = [];
let cdaService: typeof import("./cda.service").cdaService;

const STEP: CdaApprovalStep = {
  id: 12,
  round: 1,
  step_order: 2,
  name: "Board review",
  role: "bod1",
  role_label: "BOD Chairwoman",
  status_label: null,
  status: "pending",
  acted_by: null,
  acted_by_name: null,
  acted_at: null,
  remarks: null,
  closed: false,
};

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
      const body = raw ? JSON.parse(raw) : null;
      seen.push({ method: req.method ?? "", path, body });
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST" && path === "/cda/reports/5/workflow") {
        if (body.step_id === 12) {
          res.statusCode = 200;
          return res.end(JSON.stringify({ data: { id: 5 } }));
        }
        if (body.step_id === undefined) {
          res.statusCode = 422;
          return res.end(JSON.stringify({ message: MISSING, errors: { step_id: [MISSING] } }));
        }
        res.statusCode = 409;
        return res.end(JSON.stringify({ message: STALE }));
      }
      if (req.method === "DELETE" && path === "/cda/requirements/4") {
        res.statusCode = 200;
        return res.end(JSON.stringify({ success: true, message: "Requirement deleted." }));
      }
      if (req.method === "DELETE" && path === "/cda/requirements/9") {
        res.statusCode = 409;
        return res.end(JSON.stringify({ message: "Another change to this requirement was saved at the same time. Reload and try again." }));
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "not stubbed" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ cdaService } = await import("./cda.service"));
});

after(() => {
  server?.close();
});

async function refusal(work: Promise<unknown>): Promise<unknown> {
  try {
    await work;
  } catch (err) {
    return err;
  }
  assert.fail("expected a refusal");
}

describe("approve on a review chain", () => {
  test("sends the pending step's id and its remarks", async () => {
    seen.length = 0;
    await cdaService.runWorkflow(5, approveInput(STEP, "Checked"));
    assert.deepEqual(seen, [
      { method: "POST", path: "/cda/reports/5/workflow", body: { action: "approve", step_id: 12, reason: "Checked" } },
    ]);
  });

  test("a stale step answers 409: the report reloads and the sentence shows as sent", async () => {
    const err = await refusal(cdaService.runWorkflow(5, approveInput({ ...STEP, id: 11 }, null)));
    assert.equal(reloadsReport(err), true);
    assert.equal(cdaErrorMessage(err, "Could not approve"), STALE);
  });

  test("a missing step answers 422 under step_id: the report reloads and says which step", async () => {
    const err = await refusal(cdaService.runWorkflow(5, approveInput(null, null)));
    assert.equal(reloadsReport(err), true);
    assert.equal(cdaErrorMessage(err, "Could not approve"), MISSING);
  });

  test("any other refusal leaves the report as it is", () => {
    assert.equal(reloadsReport({ response: { status: 403, data: { message: "No." } } }), false);
    assert.equal(reloadsReport({ response: { status: 422, data: { errors: { reason: ["Give a reason."] } } } }), false);
  });
});

describe("deleting a custom requirement", () => {
  test("is one DELETE on the requirement", async () => {
    seen.length = 0;
    await cdaService.deleteRequirement(4);
    assert.deepEqual(seen, [{ method: "DELETE", path: "/cda/requirements/4", body: null }]);
  });

  test("a refusal reads as the server's sentence", async () => {
    const err = await refusal(cdaService.deleteRequirement(9));
    assert.equal(
      cdaErrorMessage(err, "Could not delete the requirement"),
      "Another change to this requirement was saved at the same time. Reload and try again.",
    );
  });
});
