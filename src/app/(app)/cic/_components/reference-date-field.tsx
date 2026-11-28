"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The date a live picture is built as of; never after today. */
export function ReferenceDateField({
  value,
  onChange,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  max?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="whitespace-nowrap text-sm">
        As of
      </Label>
      <Input
        id={id}
        type="date"
        className="w-40"
        value={value}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </div>
  );
}
