// src/app/(app)/borrowers/registrations/[id]/_components/approval-branch-field.tsx
"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApprovalBranchState } from "../_hooks/use-approval-branch";

interface Props {
  branch: ApprovalBranchState;
  disabled?: boolean;
}

/**
 * The branch the member is approved into. Required: the server refuses an
 * approval without one. A registration that already names its branch shows it
 * read-only, because approval never moves it; one with none offers the
 * reviewer's own branches (every branch with See all branches).
 */
export function ApprovalBranchField({ branch, disabled }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  if (branch.fixed) {
    return (
      <div className="space-y-1 text-sm">
        <p className="text-muted-foreground">Branch</p>
        <p className="font-semibold">{branch.fixedName ?? "The branch the applicant chose"}</p>
        <p className="text-[11px] text-muted-foreground">
          The applicant chose this branch. The member is approved into it.
        </p>
      </div>
    );
  }

  if (branch.loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Spinner />
        Loading branches…
      </div>
    );
  }

  const nothingToPick = branch.offered.length === 0;
  const selected = branch.offered.find((b) => b.id === branch.branchId) ?? null;
  const message =
    branch.error ??
    (branch.loadError
      ? "Branches could not be loaded. Reload the page to try again."
      : nothingToPick
        ? "None of your branches is active. Ask an administrator."
        : null);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        Branch <span className="text-destructive" aria-hidden="true">*</span>
      </Label>
      <Select
        value={branch.branchId === null ? "" : String(branch.branchId)}
        onValueChange={(next: string | null) => {
          if (next) branch.pick(Number(next));
        }}
        disabled={disabled || nothingToPick}
      >
        <SelectTrigger
          id={id}
          className="h-9 w-full"
          aria-required="true"
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${errorId} ${hintId}` : hintId}
        >
          <SelectValue>{() => selected?.name ?? "Choose a branch…"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {branch.offered.map((b) => (
            <SelectItem key={b.id} value={String(b.id)}>
              {b.name}
              {b.code ? ` (${b.code})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {message ? (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <p id={hintId} className="text-[11px] text-muted-foreground">
        The applicant didn&apos;t choose a branch. The member belongs to the one you pick.
      </p>
    </div>
  );
}
