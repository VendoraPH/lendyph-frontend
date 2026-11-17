"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { RecordDraft, RecordField } from "../_lib/record-form";

function FieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: RecordField;
  value: string;
  onChange: (v: string) => void;
  /** Read only: the control can't be changed, whatever wraps it. */
  disabled?: boolean;
}) {
  const id = `rec-${field.key}`;
  if (field.type === "textarea") {
    return (
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        readOnly={disabled}
        disabled={disabled}
      />
    );
  }
  if (field.type === "select") {
    return (
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <NativeSelectOption value="">Select…</NativeSelectOption>
        {(field.options ?? []).map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }
  if (field.type === "checkbox") {
    return (
      <Checkbox id={id} checked={value === "1"} onCheckedChange={(checked) => onChange(checked ? "1" : "")} disabled={disabled} />
    );
  }
  return (
    <Input
      id={id}
      type={field.type === "date" ? "date" : "text"}
      inputMode={field.type === "money" ? "decimal" : field.type === "number" ? "numeric" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? (field.type === "money" ? "0.00" : undefined)}
      readOnly={disabled}
      disabled={disabled}
    />
  );
}

/** A text area spans the whole row; a wide field two columns from `md`. */
function fieldSpan(field: RecordField): string {
  if (field.type === "textarea") return "col-span-full space-y-2";
  return field.wide ? "space-y-2 md:col-span-2" : "space-y-2";
}

/**
 * A two-column grid of inputs driven by a field list (carried over from #510
 * by Augustin). Textareas span both columns; money is typed as text and sent
 * as typed.
 */
export function RecordFields({
  fields,
  draft,
  onChange,
  disabled,
}: {
  fields: RecordField[];
  draft: RecordDraft;
  onChange: (draft: RecordDraft) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {fields.map((field) => (
        <div key={field.key} data-field={field.key} className={fieldSpan(field)}>
          <Label htmlFor={`rec-${field.key}`}>
            {field.label} {field.required && <span className="text-destructive">*</span>}
          </Label>
          <FieldControl
            field={field}
            value={draft[field.key] ?? ""}
            onChange={(v) => onChange({ ...draft, [field.key]: v })}
            disabled={disabled}
          />
          {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
        </div>
      ))}
    </>
  );
}
