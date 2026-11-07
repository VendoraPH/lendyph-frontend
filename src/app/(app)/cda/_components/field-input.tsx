"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { COMPLIANCE_OPTIONS, parseInput } from "../_lib/report-values";
import type { CdaField, CdaFieldValue } from "@/types/cda";

const INPUT_TYPE: Partial<Record<CdaField["type"], string>> = {
  number: "number",
  money: "number",
  percent: "number",
  date: "date",
};

/** One template field's input, by type. Values stay typed (number, boolean, null). */
export function FieldInput({
  id,
  field,
  value,
  onChange,
  disabled,
}: {
  id: string;
  field: CdaField;
  value: CdaFieldValue;
  onChange: (value: CdaFieldValue) => void;
  disabled?: boolean;
}) {
  const text = value === null || value === undefined ? "" : String(value);

  if (field.type === "boolean") {
    return <Switch id={id} checked={value === true} onCheckedChange={onChange} disabled={disabled} />;
  }
  if (field.type === "textarea") {
    return (
      <Textarea id={id} value={text} onChange={(e) => onChange(parseInput("text", e.target.value))} disabled={disabled} />
    );
  }
  if (field.type === "select" || field.type === "compliance") {
    const options = field.type === "compliance" ? COMPLIANCE_OPTIONS : (field.options ?? []);
    return (
      <NativeSelect id={id} value={text} onChange={(e) => onChange(parseInput("text", e.target.value))} disabled={disabled}>
        <NativeSelectOption value="">Select…</NativeSelectOption>
        {options.map((o) => (
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
      type={INPUT_TYPE[field.type] ?? "text"}
      inputMode={field.type === "money" || field.type === "percent" ? "decimal" : undefined}
      step={field.type === "money" ? "0.01" : undefined}
      value={text}
      onChange={(e) => onChange(parseInput(field.type, e.target.value))}
      disabled={disabled}
    />
  );
}
