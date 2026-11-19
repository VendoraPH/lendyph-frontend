"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { NamedBranch } from "@/lib/branch-choice";

interface BranchPickerProps {
  id: string;
  label: string;
  branches: readonly (NamedBranch & { code?: string | null })[];
  value: number | null;
  loading?: boolean;
  disabled?: boolean;
  onChange: (id: number | null) => void;
}

/** One branch, by name. A picked branch missing from the list still reads by its name when it can. */
export function BranchPicker({ id, label, branches, value, loading, disabled, onChange }: BranchPickerProps) {
  const selected = branches.find((b) => b.id === value) ?? null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select
        value={value === null ? "" : String(value)}
        onValueChange={(next: string | null) => onChange(next ? Number(next) : null)}
        disabled={disabled || loading}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>
            {() => (loading ? "Loading branches…" : (selected?.name ?? "Choose a branch"))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {branches.map((b) => (
            <SelectItem key={b.id} value={String(b.id)}>
              {b.name}
              {b.code ? ` (${b.code})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
