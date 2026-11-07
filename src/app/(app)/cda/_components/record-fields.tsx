"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { RecordDraft, RecordField } from "../_lib/record-form";

function FieldControl({ field, value, onChange }: { field: RecordField; value: string; onChange: (v: string) => void }) {
  const id = `rec-${field.key}`;
  if (field.type === "textarea") {
    return <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
  }
  if (field.type === "select") {
    return (
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <NativeSelectOption value="">Select…</NativeSelectOption>
        {(field.options ?? []).map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }
  return (
    <Input
      id={id}
      type={field.type === "text" ? "text" : field.type === "date" ? "date" : "number"}
      step={field.type === "money" ? "0.01" : undefined}
      min={field.type === "number" || field.type === "money" ? 0 : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  );
}

/** A two-column grid of inputs driven by a field list. Textareas span both columns. */
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
        <div key={field.key} className={field.type === "textarea" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
          <Label htmlFor={`rec-${field.key}`}>
            {field.label} {field.required && <span className="text-destructive">*</span>}
          </Label>
          <fieldset disabled={disabled} className="contents">
            <FieldControl
              field={field}
              value={draft[field.key] ?? ""}
              onChange={(v) => onChange({ ...draft, [field.key]: v })}
            />
          </fieldset>
        </div>
      ))}
    </>
  );
}
