"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { RequestField } from "@/lib/portal/requests";
import type { PickerOption } from "../_hooks/use-request-pickers";

interface RequestFieldInputProps {
  field: RequestField;
  value: string;
  onChange: (value: string) => void;
  /** For the pickers: the member's own records. */
  options?: PickerOption[];
  loading?: boolean;
  /** Shown under the field, e.g. what an account can release. */
  note?: React.ReactNode;
}

/** One field of a member request, drawn from its definition in lib/portal/requests. */
export function RequestFieldInput({ field, value, onChange, options, loading, note }: RequestFieldInputProps) {
  const id = `req-${field.key}`;
  const hint = note ?? (field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>);

  if (field.kind === "confirm") {
    return (
      <label htmlFor={id} className="flex items-start gap-2 text-sm">
        <Checkbox id={id} checked={value === "1"} onCheckedChange={(on) => onChange(on ? "1" : "")} />
        <span>{field.label}</span>
      </label>
    );
  }

  const choices = field.kind === "select" ? field.options : options;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      {choices ? (
        <NativeSelect id={id} className="w-full" value={value} onChange={(e) => onChange(e.target.value)}>
          <NativeSelectOption value="">
            {loading ? "Loading…" : choices.length === 0 ? "None available" : "Choose…"}
          </NativeSelectOption>
          {choices.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : field.kind === "textarea" ? (
        <Textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          id={id}
          inputMode={field.kind === "amount" ? "decimal" : undefined}
          placeholder={field.kind === "amount" ? "0.00" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint}
    </div>
  );
}
