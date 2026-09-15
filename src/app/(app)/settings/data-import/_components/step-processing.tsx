"use client";

/**
 * Watching an import that moves about once a minute.
 *
 * The honesty rules here all come from one fact: the server advances its cursor
 * in batches, roughly once a minute, and is idle in between. A UI built for a
 * fast operation lies about a slow one.
 *
 *  - **No indeterminate spinner as the primary indicator.** A spinning circle
 *    reads as "working right now", and for most of any given minute the server
 *    is not. The main indicator is a determinate bar built from the row counts,
 *    which only moves when rows actually move.
 *  - **Staleness comes from the server's clock.** `seconds_since_last_advance`
 *    is computed server-side precisely so a browser with a wrong clock cannot
 *    report a healthy import as stalled for hours, or the reverse. It is never
 *    recomputed from the client's own poll time.
 *  - **A stated threshold, not a silent hang.** Past three minutes the screen
 *    says so, and says what three minutes means.
 *  - **No ETA.** Batch size and row cost both vary; a number here would be
 *    invented, and an invented ETA is the thing people plan around.
 *  - **Phase labels name what is happening.** "Processing…" is what a progress
 *    bar says when nobody knows. Unknown phases are humanised rather than
 *    hidden, because a phase was added mid-build once already.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { getErrorMessage } from "@/lib/api-error";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { dataImportService } from "@/services/data-import.service";
import type { ImportCounts, ImportRunStatus } from "@/types/data-import";
import { useImportStatus } from "../_hooks/use-import-status";

/* ------------------------------------------------------------------ */
/* Pure — unit tested in ./step-processing.test.ts                      */
/* ------------------------------------------------------------------ */

/**
 * Past this, the screen says the import has been quiet for longer than
 * expected. Stated on screen rather than kept private, so "longer than
 * expected" means something the reader can check.
 */
export const STALE_AFTER_SECONDS = 180;

/**
 * Copy for the phases that exist today.
 *
 * A lookup with a fallback, NOT an exhaustive switch. `cancelled` was added
 * after the first version of this screen was written, and an exhaustive match
 * is what turned that into a blank panel.
 */
const PHASE_COPY: Record<string, string> = {
  uploading: "Receiving your files",
  assembled: "Files received and verified",
  staging: "Reading the rows out of your files",
  awaiting_mapping: "Waiting for you to confirm the loan products",
  importing_customers: "Creating members",
  importing_loans: "Creating loans",
  completed: "Finished",
  failed: "Stopped by an error",
  cancelled: "Cancelled",
};

/** A phase we have copy for, or a readable version of whatever arrived. */
export function phaseLabel(phase: string | null | undefined): string {
  if (!phase) return "Working";
  const known = PHASE_COPY[phase];
  if (known) return known;
  const words = phase.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface RowProgress {
  processed: number;
  total: number;
  /** Null when there is nothing to divide by — no bar rather than a fake one. */
  percent: number | null;
}

/**
 * Rows decided against rows staged, across every file in the run.
 *
 * `total` is every staged row and the five outcome buckets are the decided
 * ones, so the difference is exactly the work outstanding. While staging is
 * still running the denominator grows, which is honest: the run genuinely does
 * not yet know how much there is.
 */
export function rowProgress(
  files: Partial<Record<string, { counts?: ImportCounts }>> | undefined,
): RowProgress {
  let processed = 0;
  let total = 0;

  for (const file of Object.values(files ?? {})) {
    const counts = file?.counts;
    if (!counts) continue;
    total += counts.total ?? 0;
    processed +=
      (counts.imported ?? 0) +
      (counts.matched_existing ?? 0) +
      (counts.already_imported ?? 0) +
      (counts.skipped ?? 0) +
      (counts.failed ?? 0);
  }

  return {
    processed,
    total,
    percent: total > 0 ? Math.max(0, Math.min(100, (processed / total) * 100)) : null,
  };
}

/** "45s", "3m 05s", "1h 04m" — from the server's own elapsed seconds. */
export function formatElapsed(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(Math.floor(seconds % 60)).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** True when the server's own clock says nothing has moved for too long. */
export function isStale(
  secondsSinceLastAdvance: number | null | undefined,
  threshold: number = STALE_AFTER_SECONDS,
): boolean {
  return typeof secondsSinceLastAdvance === "number" && secondsSinceLastAdvance > threshold;
}

/* ------------------------------------------------------------------ */

interface CancelRefusal {
  message: string;
  phase: string | null;
  cancellablePhases: string[] | null;
}

export interface StepProcessingProps {
  runId: number;
  /**
   * The run reached a closed phase — completed, failed OR cancelled. Fired off
   * the server's own `is_closed`, never off a phase this component recognises,
   * so a phase added later still ends the step.
   */
  onSettled: () => void;
  /** The operator cancelled from here and the server agreed. */
  onCancelled: () => void;
  className?: string;
}

export function StepProcessing({
  runId,
  onSettled,
  onCancelled,
  className,
}: StepProcessingProps) {
  const [cancelling, setCancelling] = useState(false);
  const [refusal, setRefusal] = useState<CancelRefusal | null>(null);
  // Fires once. A ref rather than state: the shell moves the step machine on
  // the back of this, and re-firing on every poll would re-enter a step the
  // operator has already left.
  const announced = useRef(false);

  const handleStatus = useCallback(
    (status: ImportRunStatus) => {
      // `is_closed` is the server's answer, derived from its own phase list —
      // matching on `phase` here is what breaks when a phase is added, and one
      // was.
      if (status.is_closed && !announced.current) {
        announced.current = true;
        onSettled();
      }
    },
    [onSettled],
  );

  const { status, loading, error, stopped, refresh } = useImportStatus({
    runId,
    onStatus: handleStatus,
  });

  const progress = useMemo(() => rowProgress(status?.files), [status?.files]);
  const stale = isStale(status?.seconds_since_last_advance);
  const elapsed = formatElapsed(status?.seconds_since_last_advance);

  // Known-not-cancellable only when the SERVER has told us the accepted phases
  // and this run's phase is not among them.
  const accepted = refusal?.cancellablePhases ?? null;
  const cancelOffered =
    !stopped &&
    !!status &&
    (accepted === null || accepted.includes(status.phase));

  const cancel = useCallback(async () => {
    setCancelling(true);
    setRefusal(null);
    try {
      await dataImportService.cancel(runId);
      notifySuccess("Import cancelled", "Nothing was written to your members or loans.");
      announced.current = true;
      onCancelled();
    } catch (err) {
      const body =
        err && typeof err === "object"
          ? ((err as { response?: { data?: Record<string, unknown> } }).response?.data ?? {})
          : {};
      const phases = Array.isArray(body.cancellable_phases)
        ? (body.cancellable_phases as string[])
        : null;

      // The refusal is the useful part: it names the phase the run is in and
      // the phases it would have accepted. Swallowing it leaves an operator
      // pressing a button that does nothing.
      if (phases) {
        setRefusal({
          message: getErrorMessage(err, "This import can no longer be cancelled."),
          phase: typeof body.phase === "string" ? body.phase : null,
          cancellablePhases: phases,
        });
      } else {
        notifyError(err, "Could not cancel this import.");
      }
    } finally {
      setCancelling(false);
    }
  }, [runId, onCancelled]);

  return (
    <div className={cn("space-y-6", className)}>
      <div>
        <h2 className="font-heading text-lg font-medium">Importing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Both files are on the server and verified, so the copies on your computer
          are no longer needed. Rows are processed in batches, about once a minute.
          It is safe to close this page — the import keeps running on the server,
          and you can come back to it any time.
        </p>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium">{phaseLabel(status?.phase)}</p>
          {elapsed ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
              <Clock className="size-3.5" aria-hidden="true" />
              Last moved {elapsed} ago
            </p>
          ) : null}
        </div>

        {progress.percent !== null ? (
          <>
            {/* Rounded: the raw ratio lands in `aria-valuenow` verbatim, and a
                bar that moves once a minute has nothing to say with fifteen
                decimal places of it. */}
            <Progress
              value={Math.round(progress.percent)}
              className="mt-3"
              aria-label="Rows processed"
            >
              <ProgressLabel>
                {progress.processed.toLocaleString()} of{" "}
                {progress.total.toLocaleString()} rows
              </ProgressLabel>
              <ProgressValue />
            </Progress>
            <p className="mt-2 text-xs text-muted-foreground">
              The bar moves when rows are written, not while the server is between
              batches. No time estimate is shown, because the rate varies too much
              for one to mean anything.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {loading
              ? "Reading the run…"
              : "No rows have been counted yet — the files are still being read."}
          </p>
        )}
      </div>

      {stale ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Nothing has moved for {elapsed}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Batches normally land about once a minute, so anything past{" "}
              {Math.round(STALE_AFTER_SECONDS / 60)} minutes is longer than
              expected. That timing comes from the server&apos;s own clock, not
              this browser&apos;s. Nothing is lost — the run picks up where it left
              off — but it is worth telling whoever supports this system if it
              stays this way.
            </p>
          </div>
        </div>
      ) : null}

      {status?.phase === "awaiting_mapping" ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Waiting on the loan product mapping
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Nothing more will happen until every product named in your loans file
              is matched to a Lendyph loan product. Re-open this import from
              Settings to finish that step — the run and everything uploaded are
              kept.
            </p>
          </div>
        </div>
      ) : null}

      {status?.failure_reason ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-200">
              {phaseLabel(status.phase)}
            </p>
            {/* Rendered verbatim and never parsed: it is a fixed operator-facing
                string from the server, and nothing here may assume it names a
                row, a column or anything else. */}
            <p className="mt-0.5 text-muted-foreground">{status.failure_reason}</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">{error}</p>
            <p className="mt-0.5 text-muted-foreground">
              The import itself is unaffected — this page just could not read its
              progress. It keeps trying.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void refresh()}>
              Check now
            </Button>
          </div>
        </div>
      ) : null}

      {refusal ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
        >
          <Ban className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">{refusal.message}</p>
            <p className="mt-0.5 text-muted-foreground">
              {refusal.phase ? `This run is in “${phaseLabel(refusal.phase)}”. ` : ""}
              Cancelling is only accepted from:{" "}
              {(refusal.cancellablePhases ?? []).map(phaseLabel).join(", ")}. Past
              that, members and loans have already been written and stopping
              half-way would leave the books inconsistent.
            </p>
          </div>
        </div>
      ) : null}

      {cancelOffered ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => void cancel()} disabled={cancelling}>
            <Ban />
            {cancelling ? "Cancelling…" : "Cancel this import"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Only possible before anything has been written to your members and
            loans. The server has the final say.
          </span>
        </div>
      ) : null}
    </div>
  );
}
