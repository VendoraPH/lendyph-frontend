/**
 * The monthly late penalty's note (owner answer, backend #284): a late period
 * is charged once when grace ends and again each full month it stays unpaid,
 * and the server counts the charges in its figure as `penalty_months`, on each
 * schedule row and in the loan summary. The browser only words that count;
 * it never works out a month or an amount. Pure, so it runs under `tsx --test`.
 */

function serverNumber(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * "Penalty: N month(s) late", singular for one, or null: only where the
 * server's penalty reads above ₱0.00 and it counted at least one charge.
 */
export function penaltyMonthsNote(penalty: unknown, months: unknown): string | null {
  const amount = serverNumber(penalty);
  const count = serverNumber(months);
  // Above ₱0.00 as it is shown, to the centavo.
  if (amount === null || Math.round(amount * 100) <= 0) return null;
  if (count === null || !Number.isInteger(count) || count < 1) return null;
  return `Penalty: ${count} ${count === 1 ? "month" : "months"} late`;
}

/** The schedule row fields the note reads, as the server sends them. */
export interface PenaltyMonthsRow {
  id?: unknown;
  period_number?: unknown;
  penalty_amount?: unknown;
  penalty_months?: unknown;
}

/** What a payment preview allocation names its period by. */
export interface PenaltyAllocationRef {
  schedule_id?: number;
  period?: number;
}

/**
 * The note for a payment preview allocation's period, from that period's own
 * schedule row: by schedule id when the allocation has one, else by the
 * server's period number (never by position: numbers can skip). Null when the
 * schedule has no row for it or the row reads no note.
 */
export function allocationPenaltyNote(
  rows: readonly PenaltyMonthsRow[],
  allocation: PenaltyAllocationRef,
): string | null {
  const row =
    typeof allocation.schedule_id === "number"
      ? rows.find((r) => serverNumber(r.id) === allocation.schedule_id)
      : typeof allocation.period === "number"
        ? rows.find((r) => serverNumber(r.period_number) === allocation.period)
        : undefined;
  return row ? penaltyMonthsNote(row.penalty_amount, row.penalty_months) : null;
}
