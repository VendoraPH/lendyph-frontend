/**
 * `amlaReportApi` over real HTTP against a stub shaped like lendyph-backend's
 * AMLA-B7 routes (`routes/api/amla/reports.php`).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

let server: Server;
let base = "";
let seen: { method?: string; url?: string; body?: unknown }[] = [];
let mod: typeof import("./report-api");

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, body: raw ? JSON.parse(raw) : undefined });
      const path = (req.url ?? "").split("?")[0];
      if (path === "/api/amla/exports/41/download") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="covered-transactions-20261121-101500.csv"');
        return res.end("a,b\n1,2\n");
      }
      res.setHeader("Content-Type", "application/json");
      if (path === "/api/amla/compliance-reports/covered_transactions/exports") {
        res.statusCode = 201;
        return res.end(
          JSON.stringify({
            success: true,
            data: { id: 41, format: "csv", is_draft: true, rows: 1, download_url: `${base}/amla/exports/41/download?expires=99&fv=0&u=7&signature=abc` },
          }),
        );
      }
      return res.end(JSON.stringify({ success: true, data: { ok: path } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}/api`;
  process.env.NEXT_PUBLIC_API_URL = base;
  mod = await import("./report-api");
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const last = () => seen[seen.length - 1];

test("the catalog, a report and the counts go to the AMLA-B7 routes", async () => {
  seen = [];
  await mod.amlaReportApi.catalog();
  assert.equal(last().url, "/api/amla/compliance-reports");
  await mod.amlaReportApi.report("covered_transactions", { from: "2026-11-01", to: "2026-11-21", branch_id: 3 });
  assert.equal(last().url, "/api/amla/compliance-reports/covered_transactions?from=2026-11-01&to=2026-11-21&branch_id=3");
  await mod.amlaReportApi.report("risk_assessment", { from: "", to: "" });
  assert.equal(last().url, "/api/amla/compliance-reports/risk_assessment", "an unset filter is never sent");
  await mod.amlaReportApi.dashboardCounts();
  assert.equal(last().url, "/api/amla/dashboard/counts");
});

test("an export posts the format with the filters, then downloads through the API with its query as signed", async () => {
  seen = [];
  const made = await mod.amlaReportApi.exportReport("covered_transactions", { from: "2026-11-01", to: "2026-11-21" }, "csv");
  assert.deepEqual(last(), {
    method: "POST",
    url: "/api/amla/compliance-reports/covered_transactions/exports",
    body: { from: "2026-11-01", to: "2026-11-21", format: "csv" },
  });
  const file = await mod.amlaReportApi.download(made.download_url);
  assert.equal(last().url, "/api/amla/exports/41/download?expires=99&fv=0&u=7&signature=abc");
  assert.equal(file.filename, "covered-transactions-20261121-101500.csv");
  // axios hands Node a string for `responseType: "blob"`; the browser gets a Blob.
  const body = file.blob as unknown;
  assert.equal(typeof body === "string" ? body : await (body as Blob).text(), "a,b\n1,2\n");
});

test("only an AMLA export link is followed", () => {
  const { exportDownloadPath } = mod;
  assert.equal(
    exportDownloadPath("https://api.example.ph/api/amla/exports/12/download?expires=1&signature=x"),
    "/amla/exports/12/download?expires=1&signature=x",
  );
  assert.equal(exportDownloadPath("https://api.example.ph/api/files/12?signature=x"), null);
  assert.equal(exportDownloadPath("javascript:alert(1)//amla/exports/1/download"), null);
  assert.equal(exportDownloadPath("/amla/exports/1/download"), null);
  assert.equal(exportDownloadPath(null), null);
});

test("a link that isn't an export is refused before any request", async () => {
  seen = [];
  await assert.rejects(mod.amlaReportApi.download("https://evil.example/steal"), /Export the report again/);
  assert.equal(seen.length, 0);
});
