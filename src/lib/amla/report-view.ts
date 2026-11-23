/**
 * How the AMLA dashboard counts and the AMLA reports show (Phase 6, AMLA-B7).
 * Every figure is the server's: nothing is counted or summed here.
 */

import { AMLA_CASE_STATUS_OPTIONS } from "@/lib/amla/case-view";
import { AMLA_CDD_STATUS_OPTIONS } from "@/lib/amla/cdd-view";
import { AMLA_PRIORITY_OPTIONS } from "@/lib/amla/monitoring-view";
import type { AmlaOption } from "@/lib/amla/settings-view";
import type { AmlaDashboardCounts, AmlaReportColumn } from "@/types/amla-reports";

/** `AmlaCtrCandidate::STATUS_WORDS`. */
export const AMLA_CTR_CANDIDATE_STATUS_OPTIONS: readonly AmlaOption[] = [
  { value: "detected", label: "Detected" },
  { value: "report_prepared", label: "CTR prepared" },
  { value: "set_aside_pending", label: "Not reportable, waiting for a second approver" },
  { value: "not_reportable", label: "Not reportable, with a documented reason" },
];

/** `DashboardCounts::filings()`, most urgent first. */
export const AMLA_FILING_STANDING_OPTIONS: readonly AmlaOption[] = [
  { value: "overdue", label: "Overdue" },
  { value: "due_today", label: "Due today" },
  { value: "upcoming", label: "Due soon" },
];

export interface AmlaCountLine {
  key: string;
  label: string;
  /** The server's count; null when it didn't send this status. */
  value: number | null;
  /** The count as shown: "—" when the server didn't send it, never 0. */
  text: string;
  /** A figure that needs someone now: an overdue filing, a critical alert. */
  urgent: boolean;
}

export interface AmlaCountBlock {
  key: keyof AmlaDashboardCounts;
  title: string;
  href: string;
  linkText: string;
  /** The server's total, when it sends one. */
  total: number | null;
  lines: AmlaCountLine[];
}

interface BlockSpec {
  key: keyof AmlaDashboardCounts;
  title: string;
  href: string;
  linkText: string;
  options: readonly AmlaOption[];
  urgent: readonly string[];
}

const BLOCKS: readonly BlockSpec[] = [
  { key: "alerts", title: "Open alerts by priority", href: "/amla/alerts", linkText: "All alerts", options: AMLA_PRIORITY_OPTIONS, urgent: ["critical"] },
  { key: "filings", title: "Filing deadlines", href: "/amla/submissions", linkText: "Submissions", options: AMLA_FILING_STANDING_OPTIONS, urgent: ["overdue", "due_today"] },
  { key: "ctr_candidates", title: "CTR candidates", href: "/amla/ctr-candidates", linkText: "All candidates", options: AMLA_CTR_CANDIDATE_STATUS_OPTIONS, urgent: [] },
  { key: "cases", title: "Compliance cases", href: "/amla/cases", linkText: "All cases", options: AMLA_CASE_STATUS_OPTIONS, urgent: ["str_required"] },
  { key: "cdd", title: "Customer due diligence", href: "/amla/customers", linkText: "Worklist", options: AMLA_CDD_STATUS_OPTIONS, urgent: ["review_overdue"] },
];

/** A status the server adds later, until this screen has words for it. */
const ANOTHER_STATUS = "Another status";

/**
 * The dashboard's count blocks, only those the server sent (a block is null
 * without its key). Lines follow the known order; a key the server adds later
 * still shows, as "Another status", so no count is dropped. A known status the
 * server didn't send reads "—", never 0.
 */
export function amlaCountBlocks(counts: AmlaDashboardCounts): AmlaCountBlock[] {
  return BLOCKS.flatMap((spec) => {
    const block = counts[spec.key];
    if (block === null || block === undefined) return [];
    const known = new Set(spec.options.map((o) => o.value));
    const line = (key: string, label: string): AmlaCountLine => {
      const sent = block[key];
      const value = typeof sent === "number" ? sent : null;
      return {
        key,
        label,
        value,
        text: value === null ? "—" : String(value),
        urgent: value !== null && value > 0 && spec.urgent.includes(key),
      };
    };
    const lines = [
      ...spec.options.map((o) => line(o.value, o.label)),
      ...Object.keys(block)
        .filter((key) => key !== "total" && !known.has(key))
        .map((key) => line(key, ANOTHER_STATUS)),
    ];
    const total = typeof block.total === "number" ? block.total : null;
    return [{ key: spec.key, title: spec.title, href: spec.href, linkText: spec.linkText, total, lines }];
  });
}

/** Numbers and money read right-aligned, as in every Lendy report. */
export function amlaColumnAlign(column: AmlaReportColumn): "left" | "right" {
  return column.format === "number" || column.format === "money" ? "right" : "left";
}

/** The server's default range, this month to today (Manila), from today's `YYYY-MM-DD`. */
export function amlaDefaultRange(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 8)}01`, to: today };
}

/** The date range a period report is asked for, or why it can't be. */
export function amlaReportRangeError(from: string, to: string): string | null {
  if (from === "" || to === "") return "Pick both dates.";
  if (to < from) return "The end date can't be before the start date.";
  return null;
}
