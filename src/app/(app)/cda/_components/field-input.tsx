"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { COMPLIANCE_OPTIONS } from "../_lib/labels";
import { fromInputText } from "../_lib/report-fields";
import type { CdaField, CdaFieldValue } from "@/types/cda";

/**
 * One template field's input, by type (carried over from #510 by Augustin).
 * Numbers, money and percents are typed as text and sent as typed; the
 * server checks them and answers in words.
 */
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
  const text = value === null || value === undefined || typeof value === "boolean" ? "" : String(value);

  if (field.type === "boolean") {
    return <Switch id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked)} disabled={disabled} />;
  }
  if (field.type === "textarea") {
    return <Textarea id={id} value={text} onChange={(e) => onChange(fromInputText(e.target.value))} disabled={disabled} />;
  }
  if (field.type === "select" || field.type === "compliance") {
    const options = field.type === "compliance" ? COMPLIANCE_OPTIONS : (field.options ?? []);
    return (
      <NativeSelect id={id} value={text} onChange={(e) => onChange(fromInputText(e.target.value))} disabled={disabled}>
        <NativeSelectOption value="">Select…</NativeSelectOption>
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }
  const numeric = field.type === "money" || field.type === "percent" || field.type === "number";
  return (
    <Input
      id={id}
      type={field.type === "date" ? "date" : "text"}
      inputMode={numeric ? "decimal" : undefined}
      placeholder={field.type === "money" ? "0.00" : undefined}
      value={text}
      onChange={(e) => onChange(fromInputText(e.target.value))}
      disabled={disabled}
    />
  );
}
