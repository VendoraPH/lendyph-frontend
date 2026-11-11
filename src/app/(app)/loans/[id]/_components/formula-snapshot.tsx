import { formatCurrencyExact } from "@/lib/format";
import { describeFormulaInputs } from "@/lib/fee-expression";
import type { LoanDeduction } from "@/types/loan";

/**
 * Under a fee line charged from a written formula: the formula and the loan's
 * figures it used, as the server recorded them. Nothing for any other line.
 */
export function FormulaSnapshot({ item }: { item: Partial<Pick<LoanDeduction, "formula_expression" | "formula_inputs">> }) {
  if (!item.formula_expression) return null;
  const inputs = describeFormulaInputs(item.formula_inputs, formatCurrencyExact);
  return (
    <span className="block text-xs text-muted-foreground">
      <span className="font-mono">{item.formula_expression}</span>
      {inputs && <> with {inputs}</>}
    </span>
  );
}
