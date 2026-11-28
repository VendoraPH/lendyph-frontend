"use client";

import { useId, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatDate, todayISO } from "@/lib/format";
import { liveReferenceDates } from "../_lib/live-dates";

/**
 * The date a live picture is built as of: today, or a recent month end, the
 * only dates the server builds live. Older months are read from their
 * captures.
 */
export function ReferenceDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const today = todayISO();
  const dates = useMemo(() => liveReferenceDates(today), [today]);
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="whitespace-nowrap text-sm">
        As of
      </Label>
      <NativeSelect id={id} className="w-48" value={value} onChange={(e) => onChange(e.target.value)}>
        {dates.map((d) => (
          <NativeSelectOption key={d} value={d}>
            {d === today ? `Today, ${formatDate(d)}` : `Month end, ${formatDate(d)}`}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
