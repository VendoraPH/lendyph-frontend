"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface BaseProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

function Shell({ id, label, error, hint, required, className, children }: BaseProps & { children: ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const describedBy = (p: BaseProps) => (p.error ? `${p.id}-error` : p.hint ? `${p.id}-hint` : undefined);

export function TextField(
  p: BaseProps & {
    value: string;
    onChange: (value: string) => void;
    type?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    autoComplete?: string;
    placeholder?: string;
    maxLength?: number;
    readOnly?: boolean;
  },
) {
  return (
    <Shell {...p}>
      <Input
        id={p.id}
        type={p.type ?? "text"}
        inputMode={p.inputMode}
        autoComplete={p.autoComplete}
        placeholder={p.placeholder}
        maxLength={p.maxLength}
        readOnly={p.readOnly}
        value={p.value}
        aria-invalid={p.error ? true : undefined}
        aria-describedby={describedBy(p)}
        onChange={(e) => p.onChange(e.target.value)}
      />
    </Shell>
  );
}

/** A peso amount typed as text, so "25,000" is accepted and nothing is lost to number inputs. */
export function MoneyField(p: BaseProps & { value: string; onChange: (value: string) => void }) {
  return (
    <Shell {...p}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
        <Input
          id={p.id}
          inputMode="decimal"
          className="pl-7"
          placeholder="0"
          value={p.value}
          aria-invalid={p.error ? true : undefined}
          aria-describedby={describedBy(p)}
          onChange={(e) => p.onChange(e.target.value)}
        />
      </div>
    </Shell>
  );
}

export function SelectField(
  p: BaseProps & {
    value: string;
    onChange: (value: string) => void;
    options: readonly { value: string; label: string }[];
    placeholder?: string;
  },
) {
  return (
    <Shell {...p}>
      <NativeSelect
        id={p.id}
        className="w-full"
        value={p.value}
        aria-invalid={p.error ? true : undefined}
        aria-describedby={describedBy(p)}
        onChange={(e) => p.onChange(e.target.value)}
      >
        <NativeSelectOption value="">{p.placeholder ?? "Choose one"}</NativeSelectOption>
        {p.options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Shell>
  );
}

export function TextAreaField(p: BaseProps & { value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <Shell {...p}>
      <Textarea
        id={p.id}
        rows={p.rows ?? 3}
        value={p.value}
        aria-invalid={p.error ? true : undefined}
        aria-describedby={describedBy(p)}
        onChange={(e) => p.onChange(e.target.value)}
      />
    </Shell>
  );
}

/** `{a: "A"}` as select options. */
export const optionsOf = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
