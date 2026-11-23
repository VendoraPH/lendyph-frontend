/**
 * `amlaCaseApi` over real HTTP against a stub shaped like lendyph-backend's
 * AMLA-B6 routes (`routes/api/amla/cases.php`).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

let server: Server;
let seen: { method: string; url: string; type: string; body: string }[] = [];
let amlaCaseApi: typeof import("./case-api").amlaCaseApi;
let readBlobError: typeof import("./case-api").readBlobError;

const META = { current_page: 1, per_page: 25, total: 3, last_page: 1 };

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      seen.push({ method: req.method ?? "", url: req.url ?? "", type: String(req.headers["content-type"] ?? ""), body });
      const path = (req.url ?? "").split("?")[0];
      if (path === "/api/amla/cases" && req.method === "GET") {
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ success: true, data: [{ id: 1 }], meta: META }));
      }
      if (path === "/api/amla/reports" && req.method === "GET") {
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ success: true, data: [{ id: 2 }], meta: META }));
      }
      if (path.endsWith("/export") || path.includes("/evidence") && req.method === "GET") {
        res.setHeader("Content-Type", "application/octet-stream");
        return res.end("file");
      }
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ success: true, data: { ok: path } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ amlaCaseApi, readBlobError } = await import("./case-api"));
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("cases and reports send only the filters set and keep the server's page meta", async () => {
  seen = [];
  const cases = await amlaCaseApi.cases({ status: "open", search: " CASE ", page: 2 });
  const reports = await amlaCaseApi.reports({ type: "str", status: "", page: 1 });
  await amlaCaseApi.reports({ type: "", status: "approved", page: 1 });
  assert.deepEqual(
    seen.map((s) => s.url),
    ["/api/amla/cases?status=open&search=CASE&page=2", "/api/amla/reports?type=str&page=1", "/api/amla/reports?status=approved&page=1"],
  );
  assert.deepEqual(cases, { data: [{ id: 1 }], meta: META });
  assert.deepEqual(reports, { data: [{ id: 2 }], meta: META });
});

test("each read has its own route", async () => {
  seen = [];
  await amlaCaseApi.case(4);
  await amlaCaseApi.report(3);
  await amlaCaseApi.deadlines();
  assert.deepEqual(
    seen.map((s) => `${s.method} ${s.url}`),
    ["GET /api/amla/cases/4", "GET /api/amla/reports/3", "GET /api/amla/filing-deadlines"],
  );
});

test("case steps post to the case's routes, with trimmed text", async () => {
  seen = [];
  await amlaCaseApi.assign(4, 9);
  await amlaCaseApi.note(4, "Called");
  await amlaCaseApi.decide(4, { decision: "str", reason: "Layering", determination_date: "2026-11-19" });
  await amlaCaseApi.prepareStr(4, "Narrative");
  await amlaCaseApi.escalate(11, { title: "New case" });
  await amlaCaseApi.prepareCtr(8);
  assert.deepEqual(
    seen.map((s) => [s.method, s.url, s.body]),
    [
      ["POST", "/api/amla/cases/4/assign", JSON.stringify({ assignee_id: 9 })],
      ["POST", "/api/amla/cases/4/notes", JSON.stringify({ body: "Called" })],
      ["POST", "/api/amla/cases/4/decision", JSON.stringify({ decision: "str", reason: "Layering", determination_date: "2026-11-19" })],
      ["POST", "/api/amla/cases/4/str", JSON.stringify({ narrative: "Narrative" })],
      ["POST", "/api/amla/alerts/11/escalate", JSON.stringify({ title: "New case" })],
      ["POST", "/api/amla/ctr-candidates/8/report", "{}"],
    ],
  );
});

test("report steps post to the report's routes", async () => {
  seen = [];
  await amlaCaseApi.approveReport(3);
  await amlaCaseApi.returnReport(3, "Fix the address");
  assert.deepEqual(
    seen.map((s) => [s.method, s.url, s.body]),
    [
      ["POST", "/api/amla/reports/3/approve", "{}"],
      ["POST", "/api/amla/reports/3/return", JSON.stringify({ reason: "Fix the address" })],
    ],
  );
});

test("evidence and filing steps upload as multipart, with the note only when there is one", async () => {
  seen = [];
  const pdf = new File(["%PDF"], "ack.pdf", { type: "application/pdf" });
  await amlaCaseApi.evidence(4, pdf, "");
  await amlaCaseApi.recordSubmission(3, { status: "submitted", reference: "AMLC-1", date: "2026-11-19", note: "", evidence: pdf });
  assert.equal(seen[0].url, "/api/amla/cases/4/evidence");
  assert.match(seen[0].type, /^multipart\/form-data/);
  assert.match(seen[0].body, /name="file"; filename="ack.pdf"/);
  assert.doesNotMatch(seen[0].body, /name="description"/);
  assert.equal(seen[1].url, "/api/amla/reports/3/submissions");
  for (const part of ['name="status"', 'name="reference"', 'name="date"', 'name="evidence"; filename="ack.pdf"']) {
    assert.ok(seen[1].body.includes(part), part);
  }
  assert.doesNotMatch(seen[1].body, /name="note"/);
});

test("downloads read files from their own routes", async () => {
  seen = [];
  await amlaCaseApi.caseEvidence(4, 6);
  await amlaCaseApi.submissionEvidence(3, 2);
  await amlaCaseApi.exportReport(3);
  assert.deepEqual(
    seen.map((s) => s.url),
    ["/api/amla/cases/4/evidence/6", "/api/amla/reports/3/submissions/2/evidence", "/api/amla/reports/3/export"],
  );
});

test("a refused download reads the server's words back out of its blob body", async () => {
  const err = { response: { status: 403, data: new Blob([JSON.stringify({ message: "You can't." })]) } };
  const read = (await readBlobError(err)) as { response: { data: { message: string } } };
  assert.equal(read.response.data.message, "You can't.");
  const plain = new Error("x");
  assert.equal(await readBlobError(plain), plain);
});
