import { test } from "node:test";
import assert from "node:assert/strict";
import { historyChartCaption, historyChartPoints } from "./history-chart";
import type { CreditScoreHistoryEntry } from "@/types/credit-scoring";

function row(id: number, at: string, over: Partial<CreditScoreHistoryEntry> = {}): CreditScoreHistoryEntry {
  return {
    id,
    borrower_id: 4,
    borrower_name: "Ana Cruz",
    borrower_code: "M-0004",
    score: 70,
    risk_level: "moderate",
    score_type: "behavioral",
    model_version: "1.0",
    calculated_at: at,
    reason: "Nightly",
    status: "scored",
    previous_score: null,
    ...over,
  };
}

test("points run oldest to newest from the server's newest-first rows", () => {
  const points = historyChartPoints([
    row(3, "2026-11-09T00:45:00+08:00", { score: 80 }),
    row(2, "2026-11-08T00:45:00+08:00", { score: 75 }),
    row(1, "2026-11-07T00:45:00+08:00", { score: 70 }),
  ]);
  assert.deepEqual(points.map((p) => p.id), [1, 2, 3]);
  assert.deepEqual(points.map((p) => p.score), [70, 75, 80]);
});

test("an insufficient-data row is a gap, never 0", () => {
  const points = historyChartPoints([
    row(3, "2026-11-09T00:45:00+08:00", { score: 80 }),
    row(2, "2026-11-08T00:45:00+08:00", { status: "insufficient_data", score: null, risk_level: null }),
    row(1, "2026-11-07T00:45:00+08:00", { score: 70 }),
  ]);
  assert.deepEqual(points.map((p) => p.score), [70, null, 80]);
});

test("rows at the same time keep their id order", () => {
  const points = historyChartPoints([
    row(6, "2026-11-09T00:45:00+08:00"),
    row(5, "2026-11-09T00:45:00+08:00"),
  ]);
  assert.deepEqual(points.map((p) => p.id), [5, 6]);
});

test("the caption says when the chart holds only the latest rows", () => {
  assert.equal(historyChartCaption(100, 140), "Latest 100 of 140");
  assert.equal(historyChartCaption(40, 40), null);
});
