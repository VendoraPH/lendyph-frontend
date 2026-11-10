"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Option {
  value: string;
  label: string;
}

interface OptionSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/** A plain value/label select, the shape every savings form uses. */
export function OptionSelect({ id, value, onChange, options, placeholder, className, disabled }: OptionSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(String(v ?? ""))}
      items={options as Option[]}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
