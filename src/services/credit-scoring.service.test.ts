/**
 * The credit scoring service over real HTTP, against a stub of the C2s
 * contract (backend PR #240). The assertions read the request the service
 * actually sent: paging, filters, weights typed as text, settings without the
 * read-only version, and the assessment and decision bodies.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

interface Recorded {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
}

let server: Server;
let requests: Recorded[] = [];
let respond: (r: Recorded) => unknown = () => null;
let creditScoringService: typeof import("./credit-scoring.service").creditScoringService;

function paginator(rows: unknown[], query: Record<string, string>) {
  const perPage = Math.min(Math.max(Number.parseInt(query.per_page ?? "", 10) || 25, 1), 100);
  const page = Number.parseInt(query.page ?? "1", 10) || 1;
  return {
    current_page: page,
    data: rows.slice((page - 1) * perPage, page * perPage),
    first_page_url: "",
    from: (page - 1) * perPage + 1,
    last_page: Math.max(1, Math.ceil(rows.length / perPage)),
    per_page: perPage,
    total: rows.length,
  };
}

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const rec: Recorded = {
        method: req.method ?? "GET",
        path: url.pathname.replace(/^\/api/, ""),
        query: Object.fromEntries(url.searchParams.entries()),
        body: raw ? JSON.parse(raw) : null,
      };
      requests.push(rec);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, data: respond(rec) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  creditScoringService = (await import("./credit-scoring.service")).creditScoringService;
});

after(() => server?.close());

beforeEach(() => {
  requests = [];
  respond = () => null;
});

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ borrower_id: i + 1 }));

test("the members list asks for a page and returns the server's paging", async () => {
  respond = (r) => paginator(rows(130), r.query);
  const page = await creditScoringService.listBorrowerScores({}, { page: 2, per_page: 50 });
  assert.equal(requests[0].path, "/credit-scoring/borrowers");
  assert.equal(requests[0].query.page, "2");
  assert.equal(requests[0].query.per_page, "50");
  assert.equal(page.total, 130);
  assert.equal(page.current_page, 2);
  assert.equal(page.last_page, 3);
  assert.equal(page.data.length, 50);
});

test("a list defaults to page 1 of 25, the server's own default", async () => {
  respond = (r) => paginator(rows(30), r.query);
  await creditScoringService.listBorrowerScores();
  assert.equal(requests[0].query.page, "1");
  assert.equal(requests[0].query.per_page, "25");
});

test("filters go as query values, and the ignored ones are never sent", async () => {
  respond = (r) => paginator([], r.query);
  await creditScoringService.listBorrowerScores({
    branch_id: 3,
    risk_level: "high",
    has_active_loan: true,
    past_due: false,
  });
  const q = requests[0].query;
  assert.equal(q.branch_id, "3");
  assert.equal(q.risk_level, "high");
  assert.equal(q.has_active_loan, "true");
  assert.equal(q.past_due, "false");
  assert.equal("borrower_type" in q, false);
  assert.equal("loan_product_id" in q, false);
});

test("score history pages with its date filters", async () => {
  respond = (r) => paginator(rows(3), r.query);
  const page = await creditScoringService.getScoreHistory(
    { from: "2026-11-01", to: "2026-11-09", branch_id: 2 },
    { page: 1, per_page: 100 },
  );
  assert.equal(requests[0].path, "/credit-scoring/score-history");
  assert.deepEqual(
    { from: requests[0].query.from, to: requests[0].query.to, per_page: requests[0].query.per_page },
    { from: "2026-11-01", to: "2026-11-09", per_page: "100" },
  );
  assert.equal(page.total, 3);
});

test("a member's history pages on its own route", async () => {
  respond = (r) => paginator(rows(140), r.query);
  const page = await creditScoringService.getBorrowerScoreHistory(7, { per_page: 100 });
  assert.equal(requests[0].path, "/credit-scoring/borrowers/7/history");
  assert.equal(requests[0].query.per_page, "100");
  assert.equal(page.data.length, 100);
  assert.equal(page.total, 140);
});

test("a list answer without the paging figures throws, never an empty page", async () => {
  respond = () => ({ data: [] });
  await assert.rejects(creditScoringService.listBorrowerScores(), /Unexpected list response/);
  respond = () => [];
  await assert.rejects(creditScoringService.getScoreHistory(), /Unexpected list response/);
  respond = () => null;
  await assert.rejects(creditScoringService.getBorrowerScoreHistory(1), /Unexpected list response/);
});

test("the scorecard PUT carries weights and band minimums exactly as typed", async () => {
  respond = () => ({});
  const body = {
    categories: [
      { key: "payment_history", weight_percent: "33.33" },
      { key: "capacity", weight_percent: "26.67" },
      { key: "tenure", weight_percent: "9.5" },
      { key: "behaviour", weight_percent: "30.5" },
    ],
    factor_rules: [{ id: 1, category_key: "payment_history", label: "On time", points: 10, is_active: true }],
    policy_rules: [{ id: 2, label: "Past due", description: "d", is_active: true }],
    risk_bands: [
      { key: "very_low" as const, min_score: 90 },
      { key: "very_high" as const, min_score: 0 },
    ],
  };
  await creditScoringService.updateScorecardConfig(body);
  assert.equal(requests[0].method, "PUT");
  assert.equal(requests[0].path, "/credit-scoring/scorecard-config");
  assert.deepEqual(requests[0].body, body);
});

test("settings never send the model version or the definition lists", async () => {
  respond = () => ({});
  await creditScoringService.updateSettings({
    privacy_notice: "Notice",
    dsr_manageable_max: "35.1250",
    capacity_share: "40",
    max_active_loans: "3",
    ...({
      score_model_version: "1.1",
      confidence_definitions: [],
      hard_flag_definitions: [],
      notice_version: 2,
    } as object),
  });
  assert.deepEqual(requests[0].body, {
    privacy_notice: "Notice",
    dsr_manageable_max: "35.1250",
    capacity_share: "40",
    max_active_loans: "3",
  });
});

test("the loan assessment reads and saves on the loan's own route", async () => {
  respond = (r) => ({ loan_id: 12, editable: true, method: r.method });
  const read = await creditScoringService.getLoanAssessment(12);
  assert.equal(requests[0].method, "GET");
  assert.equal(requests[0].path, "/credit-scoring/loans/12/assessment");
  assert.equal(read.loan_id, 12);

  const body = {
    other_income: "5000.50",
    household_expenses: null,
    outside_lenders_count: "2",
    income_verification: "verified" as const,
    notice_acknowledged: true,
  };
  await creditScoringService.saveLoanAssessment(12, body);
  assert.equal(requests[1].method, "PUT");
  assert.equal(requests[1].path, "/credit-scoring/loans/12/assessment");
  assert.deepEqual(requests[1].body, body);
});

test("a decision on a loan assessment carries the loan's id", async () => {
  respond = () => ({ id: 1 });
  await creditScoringService.createCreditDecision({
    borrower_id: 4,
    credit_score_id: 55,
    decision: "refer",
    reason: "Needs a co-maker",
    loan_id: 12,
  });
  assert.equal(requests[0].path, "/credit-scoring/decisions");
  assert.deepEqual(requests[0].body, {
    borrower_id: 4,
    credit_score_id: 55,
    decision: "refer",
    reason: "Needs a co-maker",
    loan_id: 12,
  });
});
