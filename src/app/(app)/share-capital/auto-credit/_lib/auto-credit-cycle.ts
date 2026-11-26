// The half of the month a share capital auto-credit run is for (finish run
// round 8): the 15th or the 30th, as the savings auto-credit picks its cycle.
// Which pledges a half credits, and why it skips the rest, is the server's.
// Dependency-free, so it runs under `tsx --test`.

import type { AutoCreditCycle } from "@/types/share-capital";

export const AUTO_CREDIT_CYCLE_OPTIONS: readonly { value: AutoCreditCycle; label: string }[] = [
  { value: "15", label: "The 15th" },
  { value: "30", label: "The 30th" },
];

/** A half the server knows: "15" or "30", as a string. */
export function isAutoCreditCycle(value: unknown): value is AutoCreditCycle {
  return value === "15" || value === "30";
}

/**
 * The suggested half for `today` (Manila, YYYY-MM-DD), as the server defaults
 * it: the 1st to the 15th suggests the 15th, later days the 30th.
 */
export function defaultAutoCreditCycle(today: string): AutoCreditCycle {
  return Number(today.slice(8, 10)) <= 15 ? "15" : "30";
}

/** "the 15th" or "the 30th". */
export function autoCreditCycleWords(cycle: AutoCreditCycle): string {
  return cycle === "15" ? "the 15th" : "the 30th";
}

/**
 * The toast after a run: the half the server says it ran (else the one sent),
 * the server's total as already formatted, and how many it skipped, whose
 * reasons the page lists.
 */
export function runCompletedMessage(
  result: { cycle?: unknown; skipped_count?: number },
  sent: AutoCreditCycle,
  total: string,
  members: number,
): string {
  const half = autoCreditCycleWords(isAutoCreditCycle(result.cycle) ? result.cycle : sent);
  const skipped = result.skipped_count ?? 0;
  return (
    `Auto-credit for ${half} completed: ${total} credited to ${members} member${members === 1 ? "" : "s"}` +
    (skipped > 0 ? `; ${skipped} skipped (see the reasons on the page).` : ".")
  );
}
