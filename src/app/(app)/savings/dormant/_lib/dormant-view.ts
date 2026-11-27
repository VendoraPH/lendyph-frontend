import { formatCurrency } from "@/lib/format";
import type { DormancyList, DormancyTotals } from "@/types/savings-servicing";

export const DORMANCY_TABS: ReadonlyArray<{ value: DormancyList; label: string }> = [
  { value: "dormant", label: "Dormant accounts" },
  { value: "approaching", label: "Approaching dormancy" },
];

/** The three cards, from the server's totals (the same for both lists); a dash until they arrive. */
export function dormancyCards(totals: DormancyTotals | undefined): Array<{ label: string; value: string }> {
  return [
    {
      label: "Dormant accounts",
      value: totals ? `${totals.account_count} · ${formatCurrency(totals.total_balance)}` : "—",
    },
    {
      label: "Approaching dormancy",
      value: totals ? `${totals.approaching_count} · ${formatCurrency(totals.approaching_balance)}` : "—",
    },
    { label: "Reactivated this month", value: totals ? String(totals.reactivated_this_month) : "—" },
  ];
}

/** "Tomorrow", "In 12 days": when an approaching account turns dormant without member activity. */
export function daysLeftText(days: number): string {
  if (days <= 1) return "Tomorrow";
  return `In ${days} days`;
}

/** The approaching list's note: the warning window the server used. */
export function approachingNote(warningDays: number | undefined): string {
  return warningDays === undefined
    ? "Active accounts that turn dormant soon without member activity, soonest first."
    : `Active accounts that turn dormant within ${warningDays} days without member activity, soonest first.`;
}
