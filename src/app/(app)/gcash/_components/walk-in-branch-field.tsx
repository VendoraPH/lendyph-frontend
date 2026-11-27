"use client";

import { Building2 } from "lucide-react";
import { BranchSelectField } from "@/components/common/branch-select-field";
import type { WalkInBranch } from "../_hooks/use-walk-in-branch";
import { NO_BRANCH_EXPLANATION } from "../_lib/walk-in-branch";

const POSTS_HERE = "The transaction and its journal entry are recorded in this branch.";

/**
 * The walk-in Cash In / Cash Out branch: a picker when there is a choice, the
 * branch in words when there isn't, and why when the caller has none. Renders
 * nothing for a member's transaction.
 */
export function WalkInBranchField({ branch, disabled }: { branch: WalkInBranch; disabled?: boolean }) {
  const { choice, error } = branch;
  if (choice.kind === "member") return null;

  if (choice.kind === "pick") {
    return (
      <BranchSelectField
        label="Branch"
        items={choice.items}
        value={branch.value}
        onChange={branch.setValue}
        loading={branch.loading}
        disabled={disabled}
        description={POSTS_HERE}
        error={error}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Branch</p>
      {choice.kind === "fixed" ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>{choice.branch.name}</span>
        </div>
      ) : (
        // The reason Record is disabled, said once: a refusal of the same
        // thing replaces it rather than repeating it below.
        <p id={branch.reasonId} role="note" className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {error ?? NO_BRANCH_EXPLANATION}
        </p>
      )}
      {choice.kind === "fixed" && <p className="text-xs text-muted-foreground">{POSTS_HERE}</p>}
      {error && choice.kind === "fixed" && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
