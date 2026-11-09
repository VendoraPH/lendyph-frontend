"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { referenceAfterMethodChange } from "@/lib/payment-reference";

/**
 * How money came in or went out, and its reference number: the pair every
 * money screen asks for (release, extension, share capital entries,
 * auto-credit). Changing the method clears a reference typed for the old one.
 * Whether the reference is required, and what to say when it's missing, are
 * the caller's (`paymentReferenceError`).
 */
export function MethodReferenceFields<M extends string>({
  idPrefix,
  methodLabel = "Payment Method",
  options,
  method,
  reference,
  onChange,
  referenceRequired,
  problem,
  disabled = false,
  className = "grid gap-3 sm:grid-cols-2",
}: {
  idPrefix: string;
  methodLabel?: string;
  options: readonly { value: M; label: string }[];
  method: M;
  reference: string;
  onChange: (next: { method: M; reference: string }) => void;
  referenceRequired: boolean;
  problem: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const labelOf = (value: unknown) => options.find((o) => o.value === value)?.label ?? "";
  const hintId = `${idPrefix}-reference-hint`;
  return (
    <div className={className}>
      <div className="space-y-1.5 min-w-0">
        <Label id={`${idPrefix}-method-label`}>
          {methodLabel} <span className="text-red-500">*</span>
        </Label>
        <Select
          value={method}
          disabled={disabled}
          onValueChange={(value) => {
            const next = options.find((o) => o.value === value)?.value ?? method;
            onChange({ method: next, reference: referenceAfterMethodChange(method, next, reference) });
          }}
        >
          <SelectTrigger className="w-full" aria-labelledby={`${idPrefix}-method-label`}>
            <SelectValue>{(value: M) => labelOf(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 min-w-0">
        <Label htmlFor={`${idPrefix}-reference`}>
          Reference Number
          {referenceRequired && <span className="text-red-500"> *</span>}
        </Label>
        <Input
          id={`${idPrefix}-reference`}
          placeholder={referenceRequired ? "Required for this method" : "Optional"}
          maxLength={100}
          value={reference}
          disabled={disabled}
          onChange={(e) => onChange({ method, reference: e.target.value })}
          required={referenceRequired}
          aria-describedby={problem !== null ? hintId : undefined}
          className="w-full"
        />
        {problem !== null && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {problem}
          </p>
        )}
      </div>
    </div>
  );
}
