/**
 * The year-end close on the Period Closing screen.
 *
 * WHAT THIS PROVES: the preview shows the server's figures as they come (a
 * negative result reads "Net loss", a zero ₱0.00, a missing figure "—"), its
 * blocking reasons and the months it will close; the year picker lists the
 * books' years that aren't closed; months a close closed say so; Reopen is
 * offered on the latest closed year only and needs a reason; the history pages
 * on the server, 25 rows at a time, with the server's total; a 403 on the
 * preview is explained in words; a refused close shows the server's words.
 * WHAT IT DOES NOT PROVE: the server's rules (backend tests), or the DOM (no
 * DOM here; the page wiring is pinned in its source below).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AccountingPeriod, YearClose, YearClosePage, YearClosePreview } from "@/types";
import {
  REOPEN_REASON_MAX,
  YEAR_CLOSE_PER_PAGE,
  YEAR_CLOSE_FORBIDDEN,
  centavosOrDash,
  closeConfirmText,
  closeRefusalReasons,
  closeYearItems,
  defaultCloseYear,
  historyPaging,
  historyQuery,
  historyRowView,
  historyTotal,
  latestClosedId,
  loadPreview,
  netResult,
  periodYearEndLabels,
  previewView,
  reopenConfirmText,
  reopenReasonError,
  reopenReason,
} from "./year-close";

const ROOT = join(process.cwd(), "src/app/(app)/accounting/period-closing");

const preview = (over: Partial<YearClosePreview> = {}): YearClosePreview => ({
  year: 2026,
  as_of: "2026-12-31",
  net_surplus_account: { id: 80, code: "3080", name: "Undivided Net Surplus" },
  branches: [
    {
      branch: { id: 1, name: "Main" },
      lines: [
        { account_id: 10, account_code: "4010", account_name: "Interest Income", type: "income", amount: 1250050 },
        { account_id: 20, account_code: "5010", account_name: "Salaries", type: "expense", amount: 300000 },
        { account_id: 11, account_code: "4030", account_name: "Loan Processing Fee Income", type: "income", amount: 0 },
      ],
      total_income: 1250050,
      total_expenses: 300000,
      net_surplus: 950050,
    },
    {
      branch: null,
      lines: [{ account_id: 21, account_code: "5020", account_name: "Rent", type: "expense", amount: 1000000 }],
      total_income: 0,
      total_expenses: 1000000,
      net_surplus: -1000000,
    },
  ],
  total_income: 1250050,
  total_expenses: 1300000,
  net_surplus: -49950,
  periods_to_close: [
    { id: 11, name: "November 2026" },
    { id: 12, name: "December 2026" },
  ],
  draft_journals: 0,
  can_close: true,
  blocking_reasons: [],
  ...over,
});

const closeRow = (over: Partial<YearClose> = {}): YearClose => ({
  id: 7,
  year: 2025,
  status: "closed",
  net_surplus: 4200000,
  net_surplus_account: { id: 80, code: "3080", name: "Undivided Net Surplus" },
  entries: [
    { branch: { id: 1, name: "Main" }, journal: { id: 501, journal_no: "JV-000501" }, net_surplus: 4500000 },
    { branch: null, journal: { id: 502, journal_no: "JV-000502" }, net_surplus: -300000 },
  ],
  periods_closed: [
    { id: 101, name: "November 2025" },
    { id: 102, name: "December 2025" },
  ],
  closed_at: "2026-01-05T09:30:00+08:00",
  closed_by: { id: 3, name: "Ana Cruz" },
  reopened_at: null,
  reopened_by: null,
  reopen_reason: null,
  ...over,
});

const period = (id: number, code: string): AccountingPeriod => ({
  id,
  code,
  name: code,
  start_date: `${code}-01`,
  end_date: `${code}-28`,
  status: "open",
});

const httpError = (status: number, message?: string, errors?: Record<string, string[]>) => ({
  response: { status, data: { message, errors } },
});

// ── Money reads as the server sent it ──

test("a zero reads ₱0.00, and only a missing figure reads —", () => {
  assert.equal(centavosOrDash(0), "₱0.00");
  assert.equal(centavosOrDash(1250050), "₱12,500.50");
  assert.equal(centavosOrDash(null), "—");
  assert.equal(centavosOrDash(undefined), "—");
});

test("a positive result reads Net surplus, a negative one Net loss, both with the server's amount", () => {
  assert.deepEqual(netResult(950050), { label: "Net surplus", amount: "₱9,500.50", loss: false });
  assert.deepEqual(netResult(0), { label: "Net surplus", amount: "₱0.00", loss: false });
  assert.deepEqual(netResult(-1000000), { label: "Net loss", amount: "₱10,000.00", loss: true });
  assert.deepEqual(netResult(null), { label: "Net surplus", amount: "—", loss: false });
});

// ── The preview ──

test("the preview shows each branch's income and expense lines and the server's totals", () => {
  const view = previewView(preview());
  assert.equal(view.branches.length, 2);
  const [main, none] = view.branches;
  assert.equal(main.name, "Main");
  assert.deepEqual(
    main.income.map((l) => [l.account, l.amount]),
    [
      ["4010 Interest Income", "₱12,500.50"],
      ["4030 Loan Processing Fee Income", "₱0.00"],
    ],
  );
  assert.deepEqual(main.expenses.map((l) => [l.account, l.amount]), [["5010 Salaries", "₱3,000.00"]]);
  assert.equal(main.totalIncome, "₱12,500.50");
  assert.equal(main.totalExpenses, "₱3,000.00");
  assert.deepEqual(main.result, { label: "Net surplus", amount: "₱9,500.50", loss: false });

  assert.equal(none.name, "Journals with no branch");
  assert.equal(none.totalIncome, "₱0.00");
  assert.deepEqual(none.result, { label: "Net loss", amount: "₱10,000.00", loss: true });

  // The overall figures are the server's, never the branches added up here.
  assert.equal(view.totalIncome, "₱12,500.50");
  assert.equal(view.totalExpenses, "₱13,000.00");
  assert.deepEqual(view.result, { label: "Net loss", amount: "₱499.50", loss: true });
});

test("the preview names the account the result moves to, its date and the months it will close", () => {
  const view = previewView(preview());
  assert.equal(view.movesTo, "Moves to 3080 Undivided Net Surplus");
  assert.equal(view.asOf, "31 December 2026");
  assert.deepEqual(view.monthsToClose, ["November 2026", "December 2026"]);
  assert.equal(view.canClose, true);
});

test("the blocking reasons are listed as the server wrote them, and they stop the close", () => {
  const reasons = [
    "2026 ends on 31 December 2026; it can be closed from 1 January 2027",
    "3 draft journals are dated in 2026. Post or delete them first.",
  ];
  const view = previewView(preview({ can_close: false, blocking_reasons: reasons }));
  assert.deepEqual(view.blockingReasons, reasons);
  assert.equal(view.canClose, false);
});

test("Close follows can_close only: no reasons with can_close false still can't close", () => {
  assert.equal(previewView(preview({ can_close: false })).canClose, false);
  assert.equal(previewView(preview({ blocking_reasons: ["Close 2025 first"], can_close: true })).canClose, true);
});

test("the confirm names the year, the date and the account", () => {
  assert.equal(
    closeConfirmText(preview()),
    "This posts a closing entry for each branch dated 31 December 2026, moving the year's income and expenses to 3080 Undivided Net Surplus, then closes every month of 2026. Reopen only to correct the year.",
  );
});

test("a refused close shows the server's words: a 409's message, or each blocking reason on year", () => {
  assert.deepEqual(closeRefusalReasons(httpError(409, "2026 is already closed."), 2026), ["2026 is already closed."]);
  assert.deepEqual(
    closeRefusalReasons(httpError(422, "The given data was invalid.", { year: ["Close 2025 first", "December 2026 is closed. Reopen it so the closing entries can be dated 31 December."] }), 2026),
    ["Close 2025 first", "December 2026 is closed. Reopen it so the closing entries can be dated 31 December."],
  );
  assert.deepEqual(closeRefusalReasons(new Error("boom"), 2026), ["Could not close 2026."]);
});

test("a 403 on the preview is explained in words; other failures still fail", async () => {
  assert.deepEqual(await loadPreview(2026, async () => preview()), { kind: "preview", preview: preview() });
  assert.deepEqual(
    await loadPreview(2026, async () => {
      throw httpError(403, "This action is unauthorized.");
    }),
    { kind: "forbidden" },
  );
  assert.match(YEAR_CLOSE_FORBIDDEN, /every branch/);
  assert.doesNotMatch(YEAR_CLOSE_FORBIDDEN, /branches:view_all|_/);
  await assert.rejects(
    loadPreview(2026, async () => {
      throw httpError(500);
    }),
  );
});

// ── The year picker ──

test("the picker lists the books' years, oldest first, without the closed ones; its items are labels", () => {
  const periods = [period(1, "2024-12"), period(2, "2025-01"), period(3, "2025-12"), period(4, "2026-03"), period(5, "2024-11")];
  const closes = [closeRow({ year: 2024 }), closeRow({ id: 8, year: 2025, status: "reopened" })];
  const items = closeYearItems(periods, closes);
  assert.deepEqual(items, [
    { value: "2025", label: "2025" },
    { value: "2026", label: "2026" },
  ]);
  assert.equal(defaultCloseYear(items), "2025");
  assert.equal(defaultCloseYear([]), null);
});

// ── The months ──

test("months a live close closed read 'Closed by the YYYY year-end close'; a reopened close's don't", () => {
  const labels = periodYearEndLabels([
    closeRow(),
    closeRow({ id: 6, year: 2024, status: "reopened", periods_closed: [{ id: 90, name: "December 2024" }] }),
  ]);
  assert.equal(labels.get(101), "Closed by the 2025 year-end close");
  assert.equal(labels.get(102), "Closed by the 2025 year-end close");
  assert.equal(labels.has(90), false);
});

// ── History ──

test("the history asks the server for 25 rows a page and pages from its meta", () => {
  assert.equal(YEAR_CLOSE_PER_PAGE, 25);
  assert.deepEqual(historyQuery(1), { page: 1, per_page: 25 });
  assert.deepEqual(historyQuery(3), { page: 3, per_page: 25 });
  const page: YearClosePage = {
    data: [closeRow()],
    meta: { current_page: 2, last_page: 3, per_page: 25, total: 60, totals: { net_surplus: -123456 } },
  };
  assert.deepEqual(historyPaging(page), { page: 2, perPage: 25, total: 60 });
  assert.equal(historyTotal(page), "-₱1,234.56");
  assert.equal(historyTotal({ ...page, meta: { ...page.meta, totals: { net_surplus: 0 } } }), "₱0.00");
  assert.equal(historyTotal({ ...page, meta: { ...page.meta, totals: undefined as never } }), "—");
});

test("a history row shows the status in words, each branch's entry linked to its journal, who and when", () => {
  const view = historyRowView(closeRow());
  assert.equal(view.year, 2025);
  assert.equal(view.status, "Closed");
  assert.equal(view.netSurplus, "₱42,000.00");
  assert.deepEqual(
    view.entries.map((e) => [e.branch, e.journalNo, e.href, e.netSurplus]),
    [
      ["Main", "JV-000501", "/accounting/journals/501", "₱45,000.00"],
      ["Journals with no branch", "JV-000502", "/accounting/journals/502", "-₱3,000.00"],
    ],
  );
  assert.equal(view.closedBy, "Ana Cruz");
  assert.ok(view.closedAt.length > 0);
  assert.equal(view.reopenReason, null);

  const reopened = historyRowView(
    closeRow({ status: "reopened", reopened_at: "2026-02-01T10:00:00+08:00", reopened_by: { id: 4, name: "Ben Reyes" }, reopen_reason: "A December expense was missed." }),
  );
  assert.equal(reopened.status, "Reopened");
  assert.equal(reopened.reopenedBy, "Ben Reyes");
  assert.equal(reopened.reopenReason, "A December expense was missed.");
  assert.equal(historyRowView(closeRow({ closed_by: null })).closedBy, "—");
});

test("Reopen is offered on the latest closed year only", () => {
  const rows = [
    closeRow({ id: 9, year: 2026, status: "reopened" }),
    closeRow({ id: 8, year: 2025 }),
    closeRow({ id: 7, year: 2024 }),
  ];
  assert.equal(latestClosedId(rows), 8);
  assert.equal(latestClosedId([closeRow({ status: "reopened" })]), null);
  assert.equal(latestClosedId([]), null);
});

test("a reopen needs a reason, at most 500 characters, sent trimmed", () => {
  assert.equal(REOPEN_REASON_MAX, 500);
  assert.equal(reopenReasonError(""), "Enter the reason for reopening this year.");
  assert.equal(reopenReasonError("   "), "Enter the reason for reopening this year.");
  assert.equal(reopenReasonError("x".repeat(501)), "The reason can be at most 500 characters.");
  assert.equal(reopenReasonError("x".repeat(500)), null);
  assert.equal(reopenReason("  A missed expense.  "), "A missed expense.");
});

test("the reopen confirm says the closing entries are reversed and the months reopened", () => {
  assert.equal(
    reopenConfirmText(closeRow()),
    "This reverses the 2025 closing entries (JV-000501, JV-000502) and reopens the months the close closed: November 2025, December 2025.",
  );
});

// ── The page wiring, pinned in its source ──

function source(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

test("the page keeps the month list and adds the year-end close section under accounting:close", () => {
  const page = source("page.tsx");
  assert.match(page, /RouteGuard permission="accounting:close"/);
  assert.match(page, /periodYearEndLabels\(/);
  assert.match(page, /<YearEndCloseSection/);
  assert.match(page, /<YearCloseHistory/);
  assert.match(page, /PermissionGate permission="accounting:close"/);
});

test("the section previews through the service, closes only on can_close and confirms first", () => {
  const section = source("_components/year-end-close-section.tsx");
  assert.match(section, /loadPreview\(year, accountingService\.yearClosePreview\)/);
  assert.match(section, /accountingService\.closeYear\(/);
  assert.match(section, /disabled=\{!view\.canClose\}/);
  assert.match(section, /closeConfirmText\(/);
  assert.match(section, /items=\{yearItems\}/);
  assert.match(section, /YEAR_CLOSE_FORBIDDEN/);
});

test("the history pages on the server and reopens through the reason dialog", () => {
  const history = source("_components/year-close-history.tsx");
  assert.match(history, /accountingService\.yearClosesPage\(historyQuery\(page\)\)/);
  assert.match(history, /<TablePagination/);
  assert.match(history, /historyTotal\(/);
  assert.match(history, /latestClosedId\(/);
  const dialog = source("_components/reopen-year-dialog.tsx");
  assert.match(dialog, /reopenReasonError\(/);
  assert.match(dialog, /accountingService\.reopenYear\(row\.id, reopenReason\(reason\)\)/);
  assert.match(dialog, /aria-invalid/);
});

test("no $ sign or raw key reaches the screen", () => {
  const files = [
    "page.tsx",
    ...readdirSync(join(ROOT, "_components")).map((f) => join("_components", f)),
  ];
  for (const file of files) {
    const text = source(file).replace(/\$\{/g, "");
    assert.doesNotMatch(text, /\$\d|USD/, file);
    assert.doesNotMatch(text, />\s*(net_surplus|can_close|blocking_reasons|branches:view_all)\s*</, file);
  }
});
