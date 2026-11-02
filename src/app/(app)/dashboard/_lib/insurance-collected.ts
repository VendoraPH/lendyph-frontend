import { toNumber } from "@/lib/report-format";

/**
 * GET /dashboard/stats `insurance_collected`: the insurance premium collected,
 * which `total_collected` leaves out. Shown as its own line next to Collected.
 * Null when the server sent no readable figure, so the line shows a dash.
 */
export function insuranceCollected(
  stats: { total_collected?: unknown; insurance_collected?: unknown } | null | undefined,
): number | null {
  return toNumber(stats?.insurance_collected);
}
