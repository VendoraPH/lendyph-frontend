"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BranchSelectItem } from "@/lib/user-branches";

interface BranchSelectFieldProps {
  label: string;
  /** `branchChoiceItems()`: Base UI reads the closed trigger's label from these. */
  items: BranchSelectItem[];
  /** A branch id as text, `NO_BRANCH`, or null while nothing is picked. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** A line under the field saying what the choice decides. */
  description?: string;
  /** The server's refusal of this field, in its words. */
  error?: string | null;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * A form's required branch choice, labelled and described for screen readers.
 * Presentational: the form decides the items and the preselection
 * (`@/lib/branch-choice`), and what it sends.
 *
 * Import it by path: it stays out of the `components/common/index.ts` barrel.
 */
export function BranchSelectField({
  label,
  items,
  value,
  onChange,
  placeholder = "Select a branch",
  description,
  error,
  disabled,
  loading,
}: BranchSelectFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? null)} items={items} disabled={disabled}>
        <SelectTrigger
          id={id}
          className="w-full"
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        >
          <SelectValue placeholder={loading ? "Loading branches…" : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
