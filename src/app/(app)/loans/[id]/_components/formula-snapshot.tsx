import { describeFormulaSnapshot } from "@/lib/fee-form";
import type { LoanDeduction } from "@/types/loan";

/** The snapshot fields of a charged fee line, all optional. */
export type FormulaSnapshotItem = Partial<Pick<LoanDeduction, "formula_expression" | "formula_inputs" | "raw_amount">>;

/**
 * Under a fee line charged from a written formula: the formula and the loan's
 * figures it used, as the server recorded them, in words. Nothing for any
 * other line, and nothing is worked out here.
 */
export function FormulaSnapshot({ item }: { item: FormulaSnapshotItem }) {
  const view = describeFormulaSnapshot(item);
  if (!view) return null;
  return (
    <span className="mt-0.5 block text-xs text-muted-foreground">
      <span className="block">
        Formula: <span className="font-mono">{view.formula}</span>
      </span>
      {view.figures.length > 0 && <span className="block">Using {view.figures.join(" · ")}</span>}
      {view.beforeRounding && (
        <span className="block">
          Before rounding: <span className="tabular-nums">{view.beforeRounding}</span>
        </span>
      )}
    </span>
  );
}
