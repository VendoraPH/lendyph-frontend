import { test } from "node:test";
import assert from "node:assert/strict";
import { DASH } from "@/lib/report-format";
import { buildProfitSharingDoc } from "./profit-sharing-report-builder";
import type { DateRange, ReportDocument, ReportSection } from "./types";

type Table = Extract<ReportSection, { kind: "table" }>;

const RANGE: DateRange = { from: "2026-01-01", to: "2026-06-30" };

/** GET /reports/profit-sharing for the backend's hand-checked example. */
function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    cutoff_date: "2026-06-30",
    period_from: "2026-01-01",
    period_to: "2026-06-30",
    profit: {
      interest_income: 5000,
      penalty_income: 500,
      processing_fees: 1000,
      service_fee: 0,
      other_fees: 0,
      lending_fees: 1000,
      lending_income: 6500,
      expenses: 1500,
      allowance_for_credit_losses: 0,
      principal_written_off: 0,
      written_off_covered: 0,
      losses: 0,
      distributable_profit: 5000,
    },
    distribution: "shared",
    rows: [
      { borrower_id: 1, member_code: "BRW-000001", member_name: "Ana Aquino", share_capital: 10000, share_percent: 16.6667, earnings: 833.33, capital_plus_earnings: 10833.33 },
      { borrower_id: 2, member_code: "BRW-000002", member_name: "Ben Bautista", share_capital: 20000, share_percent: 33.3333, earnings: 1666.67, capital_plus_earnings: 21666.67 },
      { borrower_id: 3, member_code: "BRW-000003", member_name: "Carla Cruz", share_capital: 30000, share_percent: 50, earnings: 2500, capital_plus_earnings: 32500 },
    ],
    rows_omitted: null,
    totals: {
      member_count: 3,
      share_capital: 60000,
      share_percent: 100,
      earnings: 5000,
      capital_plus_earnings: 65000,
      rounding_remainder: 0,
      members_with_negative_balance: 0,
    },
    basis_note: "To confirm with the owner: distributable profit is the lending income received from 1 January to the cutoff date.",
    ...overrides,
  };
}

function kpiValue(doc: ReportDocument, label: string): string | undefined {
  for (const s of doc.sections) {
    if (s.kind === "kpi_grid") {
      const item = s.items.find((i) => i.label === label);
      if (item) return item.value;
    }
  }
  return undefined;
}

function tableTitled(doc: ReportDocument, title: string): Table | undefined {
  return doc.sections.find((s): s is Table => s.kind === "table" && s.title === title);
}

function notes(doc: ReportDocument): string[] {
  return doc.sections.flatMap((s) => (s.kind === "note" ? [s.text] : []));
}

/** The labels of a two-column statement's lines, its bold total last, as printed. */
function statementLabels(table: Table): string[] {
  const total = (table.totals ?? []).find((t) => t.column === "item")?.value;
  const lines = table.rows.map((row) => String(row.item));
  return total === undefined ? lines : [...lines, total];
}

test("the hand-checked example reads every figure as the server sent it", () => {
  const doc = buildProfitSharingDoc(payload(), RANGE);

  assert.equal(doc.reportId, "profit_sharing");
  assert.equal(doc.meta.title, "Profit Sharing");
  assert.equal(doc.meta.asOf, "Jun 30, 2026");
  assert.equal(doc.meta.period, undefined);

  assert.equal(kpiValue(doc, "Distributable Profit"), "₱5,000.00");
  assert.equal(kpiValue(doc, "Total Share Capital"), "₱60,000.00");
  assert.equal(kpiValue(doc, "Members Sharing"), "3");
  assert.equal(kpiValue(doc, "Earnings Shared"), "₱5,000.00");

  const reached = tableTitled(doc, "How the Profit Was Reached, Jan 1, 2026 – Jun 30, 2026");
  assert.ok(reached, "no profit statement");
  assert.deepEqual(statementLabels(reached), [
    "Interest received",
    "Penalty received",
    "Loan fees (processing, service and other)",
    "Total lending income",
    "Less: expenses",
    "Less: credit losses",
    "Distributable profit",
  ]);
  assert.deepEqual(reached.rows.map((row) => row.amount), [5000, 500, 1000, 6500, 1500, 0]);
  assert.equal(reached.totals?.find((t) => t.column === "amount")?.value, "₱5,000.00");

  const losses = tableTitled(doc, "Credit Losses");
  assert.ok(losses, "no credit losses");
  assert.deepEqual(statementLabels(losses), [
    "Allowance for credit losses, provided less released",
    "Principal written off by restructures",
    "Less: written off against the allowance or interest never received",
    "Credit losses",
  ]);

  const members = tableTitled(doc, "Members' Shares");
  assert.ok(members, "no member table");
  assert.deepEqual(members.columns.map((c) => c.header), [
    "Member ID",
    "Member Name",
    "Share Capital",
    "Share %",
    "Earnings",
    "Capital + Earnings",
  ]);
  assert.deepEqual(members.rows.map((row) => row.member_name), ["Ana Aquino", "Ben Bautista", "Carla Cruz"]);
  assert.deepEqual(members.rows.map((row) => row.earnings), [833.33, 1666.67, 2500]);
  assert.deepEqual(members.rows.map((row) => row.share_percent), [16.6667, 33.3333, 50]);
  assert.deepEqual(
    Object.fromEntries((members.totals ?? []).map((t) => [t.column, t.value])),
    {
      share_capital: "₱60,000.00",
      share_percent: "100.0%",
      earnings: "₱5,000.00",
      capital_plus_earnings: "₱65,000.00",
    },
  );

  const all = notes(doc);
  assert.equal(all.at(-1), payload().basis_note);
  assert.equal(all.some((n) => /rounding/i.test(n)), false);
  assert.equal(all.some((n) => /branch/i.test(n)), false);
});

test("a share % shows every place the server sent, never rounded to one", () => {
  const doc = buildProfitSharingDoc(payload(), RANGE);
  const members = tableTitled(doc, "Members' Shares");
  assert.ok(members);
  const column = members.columns.find((c) => c.key === "share_percent");
  assert.equal(column?.format, "rate");
});

test("the member rows withheld read the server's reason, and the figures stay", () => {
  const message = "Each member's share capital and earnings are limited to roles that can export reports. The profit and the totals are complete.";
  const doc = buildProfitSharingDoc(
    payload({ rows: null, rows_omitted: { reason: "permission_required", required_permission: "reports:export", message } }),
    RANGE,
  );

  assert.equal(tableTitled(doc, "Members' Shares"), undefined);
  assert.ok(notes(doc).includes(message));
  assert.equal(kpiValue(doc, "Earnings Shared"), "₱5,000.00");
  assert.equal(notes(doc).some((n) => n.includes("reports:export")), false);
});

test("a negative profit reads as such and says nobody shares it", () => {
  const doc = buildProfitSharingDoc(
    payload({
      distribution: "no_profit",
      profit: { ...(payload().profit as Record<string, unknown>), expenses: 8000, distributable_profit: -1500 },
      totals: { ...(payload().totals as Record<string, unknown>), earnings: 0, capital_plus_earnings: 60000 },
    }),
    RANGE,
  );

  assert.equal(kpiValue(doc, "Distributable Profit"), "-₱1,500.00");
  const kpis = doc.sections.find((s) => s.kind === "kpi_grid");
  assert.ok(kpis && kpis.kind === "kpi_grid");
  assert.equal(kpis.items.find((i) => i.label === "Distributable Profit")?.tone, "negative");
  assert.ok(
    notes(doc).includes("There is no profit to share: the distributable profit is -₱1,500.00, so every member's earnings are ₱0.00."),
  );
});

test("with no share capital it says the profit isn't shared", () => {
  const doc = buildProfitSharingDoc(payload({ distribution: "no_share_capital", rows: [] }), RANGE);
  assert.ok(notes(doc).includes("No member holds share capital on the cutoff date, so the profit is not shared."));
  assert.equal(tableTitled(doc, "Members' Shares")?.emptyText, "No member holds share capital on the cutoff date.");
});

test("a rounding remainder and members left out each say so, and the share % total is the server's", () => {
  const doc = buildProfitSharingDoc(
    payload({
      totals: {
        ...(payload().totals as Record<string, unknown>),
        share_percent: 99.9999,
        rounding_remainder: 0.01,
        members_with_negative_balance: 2,
      },
    }),
    RANGE,
  );
  const all = notes(doc);

  assert.ok(all.some((n) => n.startsWith("Rounding remainder: ₱0.01.")), all.join("\n"));
  assert.ok(all.includes("2 members with a negative share capital balance on the cutoff date are left out."));
  assert.equal(all.at(-1), payload().basis_note);
  assert.equal(tableTitled(doc, "Members' Shares")?.totals?.find((t) => t.column === "share_percent")?.value, "99.9999%");

  const one = notes(buildProfitSharingDoc(
    payload({ totals: { ...(payload().totals as Record<string, unknown>), members_with_negative_balance: 1 } }),
    RANGE,
  ));
  assert.ok(one.includes("1 member with a negative share capital balance on the cutoff date is left out."));
});

test("a failed request says the figures didn't load, never that nobody holds share capital", () => {
  const doc = buildProfitSharingDoc(null, RANGE);

  assert.equal(doc.meta.asOf, "Jun 30, 2026");
  assert.equal(kpiValue(doc, "Distributable Profit"), DASH);
  assert.equal(kpiValue(doc, "Members Sharing"), DASH);
  const reached = tableTitled(doc, "How the Profit Was Reached, Jan 1, 2026 – Jun 30, 2026");
  assert.ok(reached);
  assert.ok(reached.rows.every((row) => row.amount === null));
  assert.equal(reached.totals?.find((t) => t.column === "amount")?.value, DASH);

  assert.equal(tableTitled(doc, "Members' Shares"), undefined);
  const all = notes(doc);
  assert.deepEqual(all, ["The profit sharing figures couldn't be loaded. Please generate the report again."]);
  assert.equal(JSON.stringify(doc).includes("No member holds share capital"), false);
});
