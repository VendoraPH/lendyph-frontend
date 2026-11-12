import { formatCurrency } from "@/lib/format";
import { formatValue } from "@/lib/report-format";
import type { AccountingDashboard } from "@/types";

/** Where the banner sends the accountant: the savings subledger against the GL, by branch. */
export const SAVINGS_GL_CONTROL_HREF = "/reports/savings_gl_control";

export interface SavingsGlBanner {
  message: string;
  /** How many branch and account lines differ, in words, or null when the server sent no count. */
  detail: string | null;
}

/**
 * A peso figure the server sent as a two-decimal string, the accounting way:
 * a negative in parentheses, "(₱400.00)". Only the sign moves; the figure is
 * the server's. Anything that isn't a number reads as a dash.
 */
export function signedPesos(value: string | null | undefined): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "" || !Number.isFinite(Number(text))) return "—";
  return text.startsWith("-") ? `(${formatCurrency(text.slice(1))})` : formatCurrency(text);
}

/**
 * The Accounting dashboard's savings warning (the Savings task's TASK 62).
 * Only the server's flag decides it: nothing shows when `savings_gl_differs`
 * is false, null (savings not in use) or absent (an older server).
 */
export function savingsGlBanner(
  data: Pick<AccountingDashboard, "savings_gl_differs" | "savings_gl_control" | "as_of">,
): SavingsGlBanner | null {
  if (data.savings_gl_differs !== true) return null;
  const control = data.savings_gl_control ?? null;
  const asOf = formatValue(control?.as_of ?? data.as_of, "date");
  const lines = typeof control?.differences === "number" ? control.differences : null;
  return {
    message: `Savings records and the books differ by ${signedPesos(control?.difference)} as of ${asOf}.`,
    detail:
      lines === null || lines < 1
        ? null
        : `${lines} ${lines === 1 ? "line differs" : "lines differ"} between the savings subledger and GL 2050 or 2060.`,
  };
}
