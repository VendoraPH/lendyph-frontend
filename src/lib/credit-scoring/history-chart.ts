import type { CreditScoreHistoryEntry } from "@/types/credit-scoring";

export interface HistoryChartPoint {
  id: number;
  calculated_at: string;
  /** Null for an insufficient-data row: a gap in the line, never 0. */
  score: number | null;
}

/** The member's score over time, oldest first (the server sends newest first). */
export function historyChartPoints(rows: CreditScoreHistoryEntry[]): HistoryChartPoint[] {
  return rows
    .map((r) => ({
      id: r.id,
      calculated_at: r.calculated_at,
      score: r.status === "insufficient_data" ? null : r.score,
      time: Date.parse(r.calculated_at),
    }))
    .sort((a, b) => a.time - b.time || a.id - b.id)
    .map(({ id, calculated_at, score }) => ({ id, calculated_at, score }));
}

/** "Latest 100 of N" when the chart holds fewer rows than the server has. */
export function historyChartCaption(shown: number, total: number): string | null {
  return total > shown ? `Latest ${shown} of ${total}` : null;
}
