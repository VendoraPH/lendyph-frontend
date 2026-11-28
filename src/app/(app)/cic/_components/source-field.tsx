"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { todayISO } from "@/lib/format";
import type { CicCapture } from "@/types/cic";
import { captureLabel } from "../_lib/labels";
import type { CicSourceValue } from "../_hooks/use-cic-source";
import { ReferenceDateField } from "./reference-date-field";

/** Live (built now, as of a date) or one complete capture, frozen as it was filed. */
export function SourceField({
  value,
  onChange,
  captures,
}: {
  value: CicSourceValue;
  onChange: (value: CicSourceValue) => void;
  captures: CicCapture[];
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={id} className="whitespace-nowrap text-sm">
        Source
      </Label>
      <NativeSelect
        id={id}
        className="w-72"
        value={value.captureId === null ? "" : String(value.captureId)}
        onChange={(e) => onChange({ ...value, captureId: e.target.value ? Number(e.target.value) : null })}
      >
        <NativeSelectOption value="">Live, built now</NativeSelectOption>
        {captures.map((c) => (
          <NativeSelectOption key={c.id} value={String(c.id)}>
            {captureLabel(c)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {value.captureId === null && (
        <ReferenceDateField
          value={value.referenceDate}
          max={todayISO()}
          onChange={(referenceDate) => onChange({ ...value, referenceDate })}
        />
      )}
    </div>
  );
}
