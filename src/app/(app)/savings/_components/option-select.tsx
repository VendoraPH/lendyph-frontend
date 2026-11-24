"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
  /** Listed but can't be picked (for example, a product that isn't active yet). */
  disabled?: boolean;
}

interface OptionSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /**
   * Long labels wrap, in the list and in the field, instead of being cut off;
   * the field grows to fit the chosen one.
   */
  wrap?: boolean;
}

/** A plain value/label select, the shape every savings form uses. */
export function OptionSelect({ id, value, onChange, options, placeholder, className, disabled, wrap = false }: OptionSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(String(v ?? ""))}
      items={options as Option[]}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={cn(className ?? "w-full", wrap && "min-h-8 py-[5px] whitespace-normal data-[size=default]:h-auto")}
      >
        <SelectValue placeholder={placeholder} className={cn(wrap && "overflow-visible! break-words whitespace-normal!")} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled} wrap={wrap}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
