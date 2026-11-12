"use client";

import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiResource } from "@/hooks/use-api-resource";
import { loanApprovalService } from "@/services/loan-approval.service";
import type { ForwardCandidates } from "@/types/loan-approval";
import { ANYONE_WITH_THE_ROLE, forwardOptions } from "../_lib/approval-forward";
import type { OncePerKey } from "../_lib/once-per-key";

interface ForwardToPickerProps {
  loanId: number;
  /** The step the pick is for: the pending step's row id, or "draft". */
  stepKey: string;
  /** The page's shared read, so a remount reuses the step's candidates. */
  readCandidates: OncePerKey<ForwardCandidates>;
  /** The picked user's id as a string, or `ANYONE_WITH_THE_ROLE`. */
  value: string;
  /** The picked value and its label (the user's name, or the role default). */
  onChange: (value: string, label: string) => void;
  disabled?: boolean;
  /** The server's 422 on `forward_to_user_id`, in its words. */
  error?: string | null;
}

/**
 * The optional "Forward to" picker on Submit for Approval and Approve &
 * Forward: the role default first, then the users the server lists for the
 * next step (`GET /loans/{loan}/approval/forward-candidates`), by name.
 *
 * Mount it with a `key` per step. The candidates are read once per step
 * through the page's `readCandidates`, however often the picker remounts; a
 * new step reads its own. Nothing shows when there is no next step, or before the endpoint exists;
 * the action then goes to everyone with the role, as it always did.
 */
export function ForwardToPicker({
  loanId,
  stepKey,
  readCandidates,
  value,
  onChange,
  disabled,
  error,
}: ForwardToPickerProps) {
  const fetcher = useCallback(
    () => readCandidates(`${loanId}:${stepKey}`, () => loanApprovalService.forwardCandidates(loanId)),
    [readCandidates, loanId, stepKey],
  );
  const candidates = useApiResource(fetcher);
  const options = useMemo(() => forwardOptions(candidates.data), [candidates.data]);
  const fieldId = `forward-to-${loanId}`;
  const errorId = `${fieldId}-error`;

  if (candidates.loading) {
    return (
      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        Loading who this can be forwarded to…
      </p>
    );
  }

  if (candidates.error) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs" role="status">
        <span className="text-muted-foreground">
          We couldn&rsquo;t load who this can be forwarded to. It will go to everyone with the
          role unless you try again.
        </span>
        <Button type="button" variant="outline" size="sm" className="h-7" onClick={candidates.refetch}>
          Try again
        </Button>
      </div>
    );
  }

  if (candidates.unavailable || options.length === 0) return null;

  const nobodyByName = options.length === 1;
  // A pick the latest list no longer holds reads as the role default.
  const shown = options.some((option) => option.value === value) ? value : ANYONE_WITH_THE_ROLE;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} className="text-xs">
        Forward to <span className="text-muted-foreground font-normal">(optional)</span>
      </Label>
      <Select
        items={options}
        value={shown}
        onValueChange={(next) => {
          const picked = options.find((option) => option.value === next) ?? options[0];
          onChange(picked.value, picked.label);
        }}
        disabled={disabled || nobodyByName}
      >
        <SelectTrigger
          id={fieldId}
          className="h-9 w-full sm:w-[280px] text-xs"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {nobodyByName && (
        <p className="text-xs text-muted-foreground">
          Nobody can be picked by name for this step, so it goes to everyone with the role.
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
