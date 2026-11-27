"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** A search box that commits on Enter or blur, since each change is a request. */
export function SearchInput({
  value,
  placeholder,
  onChange,
  className,
}: {
  value: string | undefined;
  placeholder: string;
  onChange: (search: string | undefined) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label="Search"
        placeholder={placeholder}
        className="pl-8"
        defaultValue={value ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") onChange(e.currentTarget.value.trim() || undefined);
        }}
        onBlur={(e) => {
          const next = e.currentTarget.value.trim() || undefined;
          if (next !== value) onChange(next);
        }}
      />
    </div>
  );
}
