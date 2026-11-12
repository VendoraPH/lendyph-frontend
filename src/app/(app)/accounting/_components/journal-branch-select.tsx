"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranches } from "@/hooks";
import { useAuthStore } from "@/store";
import { journalBranchField, journalBranchId } from "../_lib/journal-branch";

interface JournalBranchSelectProps {
  id: string;
  /** The picked branch; null is No branch (head office). */
  value: number | null;
  onChange: (branchId: number | null) => void;
  disabled?: boolean;
}

/**
 * The branch a new expense or transfer's journal entry is recorded in, for a
 * `branches:view_all` caller: every branch, after No branch. Render it only
 * for such a caller. A branch user sees no picker, sends no `branch_id`, and
 * the server records their own branch.
 */
export function JournalBranchSelect({ id, value, onChange, disabled }: JournalBranchSelectProps) {
  const { branches, loading } = useBranches();
  const caller = useAuthStore((s) => s.user);
  const field = journalBranchField(branches, caller, true, value);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Branch</Label>
      {/* This Select hands back `string | null`; there is no null option here. */}
      <Select
        value={field.value}
        onValueChange={(v) => v !== null && onChange(journalBranchId(v))}
        items={field.items}
        disabled={disabled || loading}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        The journal entry is recorded in this branch. No branch is head office.
      </p>
    </div>
  );
}
