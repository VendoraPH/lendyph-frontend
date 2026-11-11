"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { formatCurrencyExact, formatRate } from "@/lib/format";
import {
  checkFeeFormula, FEE_FORMULA_MAX_LENGTH, FEE_FORMULA_VARIABLES, SAMPLE_FORMULA_VALUES,
} from "@/lib/fee-expression";
import { FORMULA_EXPRESSION_HELP } from "@/lib/fee-form";

const SAMPLE_LOAN =
  `${formatCurrencyExact(SAMPLE_FORMULA_VALUES.principal_amount)} principal, ` +
  `${formatRate(SAMPLE_FORMULA_VALUES.interest_rate)}% rate, ${SAMPLE_FORMULA_VALUES.loan_term}-month term`;

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/**
 * The Fee Formula input: the expression, buttons that insert each variable at
 * the cursor, and a live check that previews the fee on a sample loan. The
 * sample is only a preview; each loan is charged from its own figures.
 */
export function FormulaExpressionField({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const check = value.trim() ? checkFeeFormula(value) : null;

  function insert(label: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const pad = before && !/[\s(]$/.test(before) ? " " : "";
    const next = `${before}${pad}${label}${after}`;
    onChange(next);
    const caret = before.length + pad.length + label.length;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="fee-formula-expression">
        Fee Formula <span className="text-destructive">*</span>
      </Label>
      <p className="text-xs text-muted-foreground">{FORMULA_EXPRESSION_HELP}</p>
      <Input
        ref={inputRef}
        id="fee-formula-expression"
        className="font-mono"
        placeholder="(Principal Amount * 2.5%) / 365"
        maxLength={FEE_FORMULA_MAX_LENGTH}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={check ? !check.ok : undefined}
        aria-describedby="fee-formula-result"
      />
      <div className="flex flex-wrap gap-1.5" aria-label="Insert a variable">
        {FEE_FORMULA_VARIABLES.map((v) => (
          <Button
            key={v.key}
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            title={v.hint}
            onClick={() => insert(v.label)}
          >
            {v.label}
          </Button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Use + − * / and brackets; 2.5% means 0.025. Interest Rate is a percent (3 means 3%), Loan Term is in months.
      </p>
      <div id="fee-formula-result" aria-live="polite" className="text-xs">
        {check && !check.ok && (
          <p className="flex items-start gap-1.5 text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            {check.error}
          </p>
        )}
        {check?.ok && (
          <p className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Valid. On a sample loan ({SAMPLE_LOAN}) this comes to{" "}
              <span className="font-medium tabular-nums">{formatCurrencyExact(check.amount)}</span>
              {check.raw !== check.amount && (
                <span className="text-muted-foreground"> (unrounded {check.raw.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")})</span>
              )}
              , before the minimum and maximum.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
