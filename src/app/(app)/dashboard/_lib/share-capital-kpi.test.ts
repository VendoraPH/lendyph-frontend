import { test } from "node:test";
import assert from "node:assert/strict";
import type { ShareCapitalMembersResponse } from "@/types";
import { shareCapitalBookBalance } from "./share-capital-kpi";

const totals = { member_count: 240, total_credits: 2_500_000, total_debits: 300_000, balance: 2_200_000 };

// One member on the page, as `per_page=1` returns: adding up the page would
// give 1,500. The KPI is the book's balance from `meta.totals`.
const response = {
  data: [{ borrower_id: 7, total_credits: 2_000, total_debits: 500, balance: 1_500 }],
  meta: { current_page: 1, last_page: 240, per_page: 1, total: 240, totals, matching_totals: totals },
} as unknown as ShareCapitalMembersResponse;

test("the KPI is the server's book balance, not the page added up", () => {
  assert.equal(shareCapitalBookBalance(response), 2_200_000);
});

test("a book balance of zero is a real zero", () => {
  const zero = { ...response, meta: { ...response.meta, totals: { ...totals, balance: 0 } } };
  assert.equal(shareCapitalBookBalance(zero), 0);
});

test("a string balance off the wire is read as its number", () => {
  const str = {
    ...response,
    meta: { ...response.meta, totals: { ...totals, balance: "1234.50" as unknown as number } },
  };
  assert.equal(shareCapitalBookBalance(str), 1234.5);
});

test("no totals from the server is unknown, never 0", () => {
  assert.equal(shareCapitalBookBalance(null), null);
  assert.equal(shareCapitalBookBalance(undefined), null);
  assert.equal(shareCapitalBookBalance({ data: [] } as unknown as ShareCapitalMembersResponse), null);
  const bad = {
    ...response,
    meta: { ...response.meta, totals: { ...totals, balance: null as unknown as number } },
  };
  assert.equal(shareCapitalBookBalance(bad), null);
});
