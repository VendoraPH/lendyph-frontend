"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { formatCurrencyExact } from "@/lib/format";
import {
  FEE_FORMULA_MAX_LENGTH, FEE_FORMULA_VARIABLES, FORMULA_EXPRESSION_HELP, FORMULA_GRAMMAR_HELP, formatRawPesos,
} from "@/lib/fee-form";
import type { FormulaCheck } from "../_hooks/use-formula-check";
import { FormulaSampleLoan } from "./formula-sample-loan";

const CLAMP_NOTES = {
  min: "Raised to the minimum.",
  max: "Capped at the maximum.",
} as const;

interface Props {
  value: string;
  onChange: (value: string) => void;
  check: FormulaCheck;
  /** The server's refusal of the last save, on this field, as sent. */
  saveError: string | null;
}

/**
 * The Fee Formula input: the expression, buttons that insert each variable at
 * the cursor with what it means, and the server's check on a sample loan. The
 * browser never works the formula out.
 */
export function FormulaExpressionField({ value, onChange, check, saveError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { state } = check;
  const invalid = saveError !== null || state.status === "invalid";

  function insert(label: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const pad = before && !/[\s(]$/.test(before) ? " " : "";
    onChange(`${before}${pad}${label}${after}`);
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
        aria-invalid={invalid || undefined}
        aria-describedby="fee-formula-result fee-formula-variables"
      />
      {saveError && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          {saveError}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Insert a variable">
        {FEE_FORMULA_VARIABLES.map((v) => (
          <Button
            key={v.label}
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
      <dl id="fee-formula-variables" className="space-y-0.5 text-[11px] text-muted-foreground">
        {FEE_FORMULA_VARIABLES.map((v) => (
          <div key={v.label}>
            <dt className="inline font-medium">{v.label}: </dt>
            <dd className="inline">{v.hint}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-muted-foreground">{FORMULA_GRAMMAR_HELP}</p>

      <FormulaSampleLoan sample={check.sample} onChange={check.setSample} />

      <div id="fee-formula-result" aria-live="polite" className="text-xs">
        {state.status === "checking" && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Spinner className="size-3" />
            Checking the formula…
          </p>
        )}
        {(state.status === "incomplete" || state.status === "invalid") && (
          <p className="flex items-start gap-1.5 text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            {state.message}
          </p>
        )}
        {state.status === "sample" && (
          <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              On the sample loan: {state.message} The formula itself is accepted; change the sample loan to see an amount.
            </span>
          </p>
        )}
        {state.status === "failed" && (
          <div className="flex flex-wrap items-center gap-2 text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>{state.message}</span>
            <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={check.retry}>
              Check again
            </Button>
          </div>
        )}
        {state.status === "valid" && (
          <div className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
            <div className="space-y-0.5">
              <p>
                Valid. On the sample loan this fee comes to{" "}
                <span className="font-medium tabular-nums">{formatCurrencyExact(state.result.amount)}</span>.
              </p>
              <p className="text-muted-foreground">
                Before rounding: <span className="tabular-nums">{formatRawPesos(state.result.raw_amount)}</span>
              </p>
              {state.result.clamped && <p className="text-muted-foreground">{CLAMP_NOTES[state.result.clamped]}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
