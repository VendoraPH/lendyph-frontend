"use client";

/**
 * Step 1 — pick the branch and the two files. Nothing is uploaded here.
 *
 * Two things on this screen are load-bearing rather than decorative: the branch
 * is a hard requirement the shared hook does not treat as one (see `BranchGate`
 * below), and the files go in two separately-labelled slots because the
 * importer keys them by name (see `file-slot.tsx`).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Building2, RotateCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useBranches } from "@/hooks";
import { formatDate } from "@/lib/format";
import type { ImportRunStatus } from "@/types/data-import";

import { FileSlot } from "./file-slot";
import type { ImportFiles } from "./data-import-view";

/**
 * The app's caution surface. `Alert` ships `default` and `destructive` only,
 * and neither fits a "read this before you continue" — default is invisible,
 * destructive says something is broken. Same amber the public registration form
 * uses for its verification notice, so the two read as the same class of
 * message.
 */
const CAUTION =
  "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10";

export interface StepPrepareProps {
  branchId: number | null;
  onBranchChange: (branchId: number | null) => void;
  files: ImportFiles;
  onFilesChange: (files: ImportFiles) => void;
  /**
   * A run that has already finished, found during reattach. Its presence is the
   * whole prior-import warning: we can name the run and what it did.
   */
  priorRun: ImportRunStatus | null;
  onViewPriorRun: () => void;
  onNext: () => void;
}

// ---------------------------------------------------------------------------
// Branch gate
// ---------------------------------------------------------------------------

/**
 * Hard-blocks step 1 until a branch is actually available.
 *
 * `useBranches` fails soft on purpose — an error leaves the list empty so a
 * branch FILTER can fall back to "All Branches" rather than break a page over
 * an optional control. That is right for every other caller and wrong here, and
 * the fix belongs at this call site rather than in the hook: changing the hook
 * would turn every filter in the app into a blocking dependency on a list it
 * does not need.
 *
 * Why blocking: `loans.branch_id` is NOT NULL, and the importer copies each
 * loan's branch from the member it is attached to. A run with no branch does
 * not degrade — it reaches the database and fails there, once per loan, with a
 * raw integrity-constraint error per row. The admin sees hundreds of SQL
 * strings and no way to tell that one dropdown was the cause.
 *
 * "No active branches" blocks for the same reason: an empty list is not a
 * softer version of a failed one, it is the same run that cannot start.
 *
 * The retry remounts this component rather than calling a refetch, because the
 * hook does not expose one. Keying on the caller's counter is the honest way to
 * re-run its effect without reaching into it.
 */
function BranchGate({
  value,
  onChange,
  onRetry,
  children,
}: {
  value: number | null;
  onChange: (branchId: number | null) => void;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  const { branches, loading, error } = useBranches();

  // binhs-coop production has exactly one branch. Pre-selecting it removes a
  // click that has no decision in it — but the control stays on screen and
  // captioned, because a branch silently chosen for you is the one field nobody
  // checks, and it is the field that decides where an entire book lands.
  useEffect(() => {
    if (value === null && branches.length === 1) {
      onChange(branches[0].id);
    }
  }, [branches, value, onChange]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border p-4 text-sm text-muted-foreground">
        <Spinner />
        Loading branches…
      </div>
    );
  }

  if (error || branches.length === 0) {
    const noBranches = !error && branches.length === 0;
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>
          {noBranches
            ? "No active branch to import into"
            : "Branches could not be loaded"}
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            An import cannot run without a branch. Every member it creates is
            filed under one, and every loan takes its branch from its member —
            a loan with no branch is rejected by the database, not by this page,
            so the run would fail one row at a time with nothing useful to read.
          </p>
          <div className="flex flex-wrap gap-2">
            {!noBranches && (
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                <RotateCw className="size-3.5" aria-hidden="true" />
                Try again
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/settings/branches" />}
            >
              <Building2 className="size-3.5" aria-hidden="true" />
              {noBranches ? "Add a branch" : "Open branch settings"}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const selected = branches.find((b) => b.id === value) ?? null;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="import-branch" className="text-sm font-medium">
          Branch <span className="text-destructive" aria-hidden="true">*</span>
        </Label>
        <Select
          value={value === null ? "" : String(value)}
          onValueChange={(next: string | null) =>
            onChange(next ? Number(next) : null)
          }
        >
          <SelectTrigger id="import-branch" className="h-9 w-full sm:w-72">
            <SelectValue>
              {() => selected?.name ?? "Choose a branch…"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={String(branch.id)}>
                {branch.name}
                {branch.code ? ` (${branch.code})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {branches.length === 1
            ? "1 active branch configured, and it is selected. Every imported member and loan lands here."
            : `${branches.length} active branches configured. Every imported member and loan lands in the one you pick.`}
        </p>
      </div>

      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export function StepPrepare({
  branchId,
  onBranchChange,
  files,
  onFilesChange,
  priorRun,
  onViewPriorRun,
  onNext,
}: StepPrepareProps) {
  const [branchReload, setBranchReload] = useState(0);

  const hasAnyFile = Boolean(files.customers || files.loans);
  const loansOnly = Boolean(files.loans && !files.customers);
  const canContinue = branchId !== null && hasAnyFile;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Prepare the import</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose the branch this book belongs to and pick the exported CSVs.
          Nothing is sent until you have reviewed the checks on the next step.
        </p>
      </div>

      {priorRun ? (
        // Amber rather than the default surface, matching the caution banner on
        // the public registration form — this is a "read before you continue",
        // not an error, and the two must not look the same.
        <Alert className={CAUTION}>
          <AlertTriangle className="text-amber-600" />
          <AlertTitle>This coop has already been imported once</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Import #{priorRun.id} finished
              {priorRun.as_of_date
                ? ` (as of ${formatDate(priorRun.as_of_date)})`
                : ""}{" "}
              and is no longer running. Rows it already brought in are matched
              on re-import and reported as{" "}
              <span className="font-medium">already imported</span> rather than
              duplicated — but a corrected file does not overwrite what landed
              the first time. Fix those records in the app instead.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={onViewPriorRun}>
              View that import&apos;s result
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <BranchGate
        key={branchReload}
        value={branchId}
        onChange={onBranchChange}
        onRetry={() => setBranchReload((n) => n + 1)}
      >
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Files</legend>
          <p className="text-xs text-muted-foreground">
            At least one file is required; most migrations use both. They go in
            separate slots because the importer has to be told which is which —
            it cannot work that out from the order you picked them in.
          </p>

          <FileSlot
            label="Members file"
            description="One row per member of the existing book."
            hint="Exported as CSV from your spreadsheet: File → Save As (or Download) → CSV."
            file={files.customers}
            onSelect={(file) => onFilesChange({ ...files, customers: file })}
            optional
          />

          <FileSlot
            label="Loans file"
            description="One row per loan, referencing members by their account number."
            hint="Loans are matched to members by account number, so both files must use the same one."
            file={files.loans}
            onSelect={(file) => onFilesChange({ ...files, loans: file })}
            optional
          />

          {loansOnly ? (
            <Alert className={CAUTION}>
              <AlertTriangle className="text-amber-600" />
              <AlertTitle>Loans only — no members will be created</AlertTitle>
              <AlertDescription>
                Every loan has to match a member that already exists in Lendyph.
                Any loan whose account number is not found is reported as failed
                rather than creating the member for you.
              </AlertDescription>
            </Alert>
          ) : null}
        </fieldset>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
          {/* A disabled button is not focusable, so a screen reader never
              reaches it to find out why. Say what is missing in ordinary
              visible text instead — which also answers it for everyone else. */}
          {!canContinue ? (
            <p className="text-xs text-muted-foreground">
              {branchId === null
                ? "Choose a branch to continue."
                : "Pick at least one file to continue."}
            </p>
          ) : null}
          <Button type="button" onClick={onNext} disabled={!canContinue}>
            Check the files
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </BranchGate>
    </div>
  );
}
