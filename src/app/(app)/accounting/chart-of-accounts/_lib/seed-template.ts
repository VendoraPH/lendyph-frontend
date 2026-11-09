import { COOPERATIVE_CHART_ADDITIONS, templateChart, type SeedAccount } from "@/constants/chart-of-accounts";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import type { ChartTemplate } from "@/types";

/** What each template's equity and liabilities hold, as the seed card offers it. */
export const TEMPLATE_SUMMARIES: Record<ChartTemplate, string> = {
  lending_company: "Lending company: capital and retained earnings",
  cooperative:
    "Cooperative: share capital, statutory funds, undivided net surplus, savings and time deposits",
};

/** The picked template, or null while nothing (or an unknown value) is picked. */
export function chartTemplateFromValue(value: string | null): ChartTemplate | null {
  return value === "lending_company" || value === "cooperative" ? value : null;
}

/** A row of the seed preview; `cooperative` marks the cooperative template's additions. */
export interface SeedPreviewRow extends SeedAccount {
  cooperative: boolean;
}

const COOPERATIVE_CODES = new Set(COOPERATIVE_CHART_ADDITIONS.map((a) => a.code));

/** The rows a template will create, in code order. */
export function seedPreviewRows(template: ChartTemplate): SeedPreviewRow[] {
  return templateChart(template).map((row) => ({
    ...row,
    cooperative: template === "cooperative" && COOPERATIVE_CODES.has(row.code),
  }));
}

/**
 * The server's own words when it refuses the template (422 on `template`), or
 * null for any other answer, which the shared handler shows instead.
 */
export function seedTemplateError(err: unknown): string | null {
  if (httpStatusOf(err) !== 422) return null;
  const errors = (err as { response?: { data?: { errors?: Record<string, unknown> } } }).response?.data
    ?.errors;
  if (!errors || !("template" in errors)) return null;
  return getErrorMessage(err, "This chart template can't be used.");
}
