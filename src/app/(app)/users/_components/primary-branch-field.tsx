"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ORGANISATION_WIDE,
  primaryBranchFromValue,
  primaryBranchValue,
  type PrimaryBranchChoice,
  type PrimaryBranchOption,
} from "../_lib/primary-branch";

/**
 * The user form's Primary Branch (Phase 6 MB-BE6): one of the branches the
 * form assigns, or Organisation-wide when the role sees every branch. The
 * dialog works out the options and the choice shown (`shownPrimaryBranch`);
 * this only draws them. Locked, it shows the server's name for the stored
 * primary branch, read-only, with the reason underneath.
 */
export function PrimaryBranchField({
  id,
  options,
  value,
  onChange,
  lockReason,
  lockedValue,
}: {
  id: string;
  options: PrimaryBranchOption[];
  value: PrimaryBranchChoice;
  onChange: (choice: PrimaryBranchChoice) => void;
  lockReason?: string | null;
  /** The server's `primary_branch_name`, shown while locked. */
  lockedValue?: string | null;
}) {
  const noBranch = options.every((o) => o.value === ORGANISATION_WIDE);
  const organisationWide = options.some((o) => o.value === ORGANISATION_WIDE);
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        Primary Branch <span className="text-red-500">*</span>
      </Label>
      {lockReason ? (
        <Input id={id} value={lockedValue ?? "—"} readOnly disabled aria-describedby={hintId} />
      ) : (
        <Select
          items={options}
          value={primaryBranchValue(value)}
          onValueChange={(v) => onChange(primaryBranchFromValue(v))}
          disabled={noBranch}
        >
          <SelectTrigger id={id} className="w-full" aria-describedby={hintId}>
            <SelectValue placeholder={noBranch ? "Select branches first" : "Choose the primary branch"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <p id={hintId} className="text-xs text-muted-foreground">
        {lockReason ??
          (organisationWide
            ? "The branch this user mainly works in, or Organisation-wide."
            : "The branch this user mainly works in. Entries they record without picking a branch go to it.")}
      </p>
    </div>
  );
}
