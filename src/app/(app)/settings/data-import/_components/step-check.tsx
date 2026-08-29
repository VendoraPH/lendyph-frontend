"use client";

/**
 * Step 2 — the pre-check.
 *
 * Everything on this screen happens in the browser, before a byte is uploaded,
 * because every problem it finds is cheap to fix at "re-export the sheet" and
 * expensive to fix at "we imported four thousand loans". The file is read once,
 * whole, through `readCsvFile` — which owns the single streaming decoder that
 * keeps `Peña` from arriving as `Pe?a`.
 *
 * The screen reports what it found and the evidence behind it, and it asks
 * rather than guesses on the one question the file cannot answer: whether
 * `03/04/2020` is 3 April or 4 March.
 *
 * `StepCheckProps` is the seam between this step and the shell that renders it.
 */

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileWarning,
  History,
  Info,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { DateOrder } from "@/lib/import-date";
import { loadImportSession, type ImportSession } from "@/lib/import-session";
import { formatCount } from "@/lib/report-format";
import type { ImportFileKind } from "@/types/data-import";
import {
  collapseForSession,
  useFilePrecheck,
  type FileFindings,
  type FileInspection,
} from "../_hooks/use-file-precheck";
import { DateFormatCard } from "./date-format-card";
import { HeaderDetectionCard } from "./header-detection-card";
import { PrecheckErrorsTable } from "./precheck-errors-table";
import { PrecheckSummary } from "./precheck-summary";
import { ProductMappingGate } from "./product-mapping-table";

// ---------------------------------------------------------------------------
// The contract with the shell
// ---------------------------------------------------------------------------

/**
 * The picked files, keyed by upload slot.
 *
 * The keys are `ImportFileKind` — `"customers"`, not `"members"`. That is what
 * the server keys on in both the chunk route (`/files/{kind}/chunks/{index}`)
 * and the status payload's `files` map, and a second client-side vocabulary for
 * the same slot costs nothing at compile time (`ImportSession.files` is
 * `Record<string, …>`) and silently costs the resume at runtime.
 *
 * Declared structurally rather than imported from the shell so the seam does
 * not point both ways; the shell's own alias satisfies it.
 */
export type ImportFiles = Partial<Record<ImportFileKind, File | null | undefined>>;

/**
 * What this step hands back.
 *
 * Deliberately `Pick<ImportSession, …>` rather than a parallel declaration: it
 * is exactly the slice of the persisted record this step is responsible for
 * filling, so if that record grows a field this breaks loudly instead of
 * dropping one silently on resume.
 */
export type PrecheckOutcome = Pick<
  ImportSession,
  "hasHeaderRow" | "dateFormat" | "productMap"
>;

/**
 * What the pre-check settled about ONE file.
 *
 * This is finer-grained than `PrecheckOutcome` on purpose, and the difference
 * is not cosmetic. `ImportSession` holds ONE `hasHeaderRow` and ONE
 * `dateFormat`; the server holds `header_skipped` PER FILE
 * (`ImportFileStatus.staging.header_skipped`), and a date order is settled per
 * COLUMN. One file having a header row while the other does not is the ordinary
 * case, not an edge one — the client's spec tells coops to delete it and they
 * delete it from one sheet.
 *
 * So this rides along as `onConfirm`'s second argument. Nothing is required to
 * read it, and nothing is lost by the shell not reading it yet.
 */
export interface FilePrecheckDecision {
  /**
   * Whether row 1 is the header row and must be skipped when this file is
   * uploaded. Starts at what `detectHeaderRow` found; the admin can overrule.
   */
  skipHeaderRow: boolean;
  /** True when this is the admin's answer rather than the detected one. */
  headerOverridden: boolean;
  /**
   * How each date column is to be read, keyed by the column key from
   * `import-schema` (`birthdate`, `date_released`, `maturity_date`).
   * `null` means the column needs no order — it holds only ISO dates and/or
   * Excel serials, which carry their own meaning. A key is never absent for a
   * date column, and never carries an unsettled value: the step cannot be
   * confirmed while one is outstanding.
   */
  dateOrders: Record<string, DateOrder | null>;
  /** The delimiter the file was actually read with. */
  delimiter: string;
  /** Data rows, from the COMPLETE parse. Never a checked subset. */
  rowCount: number;
  /** Columns in the majority of rows. */
  columnCount: number;
  /** Rows carrying at least one error, over the rows that were checked. */
  failingRows: number;
  /** Warnings over the rows that were checked. Never added to `failingRows`. */
  warnings: number;
  /**
   * Rows the per-row checks did not reach (see `ROW_CHECK_CEILING`). Above
   * zero, `failingRows` and `warnings` are a floor, not a total — say so
   * wherever they are shown again.
   */
  rowsNotChecked: number;
}

export interface PrecheckDecisions {
  /**
   * The run these decisions belong to, or `null` if the shell had not created
   * one when the check ran. Carried so a later step cannot apply step 2's
   * answers to a different run.
   */
  runId: number | null;
  /** Empty on a resumed run: the files were never re-read, so there is no
   *  per-file detail to report and inventing some would be worse than none. */
  files: Partial<Record<ImportFileKind, FilePrecheckDecision>>;
  /**
   * What `PrecheckOutcome` could not carry, in words, already shown to the
   * admin. Empty in the ordinary case. See `collapseForSession`.
   */
  losses: string[];
}

export interface StepCheckProps {
  /**
   * The branch the imported members and loans are created under. Accepted for
   * completeness of the step contract; the pre-check itself is branch-agnostic,
   * so `null` is not a problem here — step 1 owns that requirement.
   */
  branchId: number | null;
  /**
   * The files picked in step 1. Read by identity: pass the same `File` objects
   * between renders, or both files are re-read every time.
   *
   * May be EMPTY, and that is a real state rather than a mistake: a `File`
   * handle cannot survive a reload, so a resumed run arrives with a run id and
   * no files. See the resumed branch below — it does not re-run the check.
   *
   * Passing one file is also valid; the cross-file member check is then skipped
   * rather than guessed at.
   */
  files: ImportFiles;
  /** The run, once the shell has created one. The pre-check itself never calls
   *  the server, so `null` is fine; it is stamped onto the decisions. */
  runId: number | null;
  onBack: () => void;
  /**
   * Called when the admin accepts the pre-check. Never fires while a blocker or
   * an unanswered date question is outstanding.
   *
   * The second argument is the lossless, per-file form of the same answers. A
   * handler declared as `(outcome) => void` satisfies this signature unchanged.
   */
  onConfirm: (outcome: PrecheckOutcome, decisions: PrecheckDecisions) => void;
  /**
   * The stored session, when the shell already holds it. Omitted, the resumed
   * branch reads it itself with `loadImportSession()`. Passing it avoids two
   * reads of one record that could disagree — the shell remains the owner of
   * the decision to resume; this only renders the consequence.
   */
  session?: ImportSession | null;
  /**
   * Render the product-mapping gate under the pre-check, filling
   * `outcome.productMap`. Off by default: the server cannot answer
   * `GET /product-mapping` until the run has staged, so only the step that owns
   * `awaiting_mapping` should turn this on. That step can equally render
   * `<ProductMappingGate>` from `./product-mapping-table` directly.
   */
  showProductMapping?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FilePair {
  inspection: FileInspection;
  findings: FileFindings;
}

const FILE_ORDER: ImportFileKind[] = ["customers", "loans"];

/** The stored session, when it is the one this run belongs to. */
function resumableSession(
  runId: number | null,
  provided: ImportSession | null | undefined,
): ImportSession | null {
  if (runId === null) return null;
  const session = provided === undefined ? loadImportSession() : provided;
  if (!session) return null;
  // Compared as strings: the run id is a number on the contract and the session
  // id is a string, and a resume that silently attaches step 2's answers to a
  // different run is the failure this check exists for.
  return String(session.sessionId) === String(runId) ? session : null;
}

export function StepCheck({
  files,
  runId,
  onBack,
  onConfirm,
  session,
  showProductMapping = false,
}: StepCheckProps) {
  const precheck = useFilePrecheck(files);
  const [productMap, setProductMap] = useState<Record<string, number>>({});
  const [mappingWarnings, setMappingWarnings] = useState<string[]>([]);
  const {
    status,
    progress,
    error,
    inspections,
    findings,
    skipHeader,
    setSkipHeader,
    headerOverridden,
    setDateOrder,
    blockers,
    pendingDecisions,
    totalWarnings,
    totalFailingRows,
    retry,
  } = precheck;

  const pairs = useMemo<FilePair[]>(() => {
    const list: FilePair[] = [];
    for (const kind of FILE_ORDER) {
      const inspection = inspections[kind];
      const found = findings[kind];
      if (inspection && found) list.push({ inspection, findings: found });
    }
    return list;
  }, [inspections, findings]);

  const decided = useMemo(() => {
    const perFile: Partial<Record<ImportFileKind, FilePrecheckDecision>> = {};
    for (const { inspection, findings: found } of pairs) {
      const dateOrders: Record<string, DateOrder | null> = {};
      for (const date of found.dates) {
        // `undefined` cannot reach here: Continue stays disabled while any
        // column is unsettled, and a blocked column is a blocker.
        dateOrders[date.key] = date.order ?? null;
      }
      perFile[inspection.kind] = {
        skipHeaderRow: skipHeader(inspection.kind),
        headerOverridden: headerOverridden(inspection.kind),
        dateOrders,
        delimiter: inspection.delimiter,
        rowCount: found.totalRows,
        columnCount: inspection.widths[0]?.columns ?? 0,
        failingRows: found.failingRows,
        warnings: found.warningCount,
        rowsNotChecked: found.rowsNotChecked,
      };
    }
    const collapsed = collapseForSession(
      pairs.map(({ inspection }) => ({
        label: inspection.label,
        skipHeaderRow: skipHeader(inspection.kind),
        dateOrders: perFile[inspection.kind]?.dateOrders ?? {},
      })),
    );
    return { perFile, collapsed };
  }, [pairs, skipHeader, headerOverridden]);

  const handleConfirm = useCallback(() => {
    onConfirm(
      {
        hasHeaderRow: decided.collapsed.hasHeaderRow,
        dateFormat: decided.collapsed.dateFormat,
        productMap,
      },
      { runId, files: decided.perFile, losses: decided.collapsed.losses },
    );
  }, [decided, productMap, runId, onConfirm]);

  const hasFiles = Boolean(files.customers || files.loans);

  // -------------------------------------------------------------------------
  // Resumed run: a run id, but no file to read
  // -------------------------------------------------------------------------
  if (!hasFiles) {
    const stored = resumableSession(runId, session);

    if (stored) {
      const mapped = Object.keys(stored.productMap).length;
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-muted-foreground" aria-hidden="true" />
              This import was already checked
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your browser cannot hold on to a file across a reload, so the rows are not here to
              check again — but the answers you gave are saved with this import and are used as they
              stand. Nothing is re-read and nothing is re-guessed.
            </p>

            <dl className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Header row</dt>
                <dd className="font-medium">
                  {stored.hasHeaderRow ? "Row 1 is skipped" : "Row 1 is imported"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Date format</dt>
                <dd className="font-mono text-sm font-medium">{stored.dateFormat}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Loan products mapped</dt>
                <dd className="font-medium tabular-nums">{formatCount(mapped)}</dd>
              </div>
            </dl>

            <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                If you are not sure these are still right — or the file has changed since — choose
                the files again and the whole check runs from scratch.
              </span>
            </p>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={onBack}>
                <RefreshCw aria-hidden="true" />
                Choose the files again
              </Button>
              <Button
                onClick={() =>
                  onConfirm(
                    {
                      hasHeaderRow: stored.hasHeaderRow,
                      dateFormat: stored.dateFormat,
                      productMap: stored.productMap,
                    },
                    // No per-file detail: the files were never re-read, and
                    // inventing some would be worse than reporting none.
                    { runId, files: {}, losses: [] },
                  )
                }
              >
                Continue with these answers
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="flex items-start gap-3 text-sm">
            <FileWarning className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {runId === null
              ? "No files have been chosen yet. Go back and pick your CSV files to check them."
              : "This import is open on the server, but the files are not in this browser — a file cannot survive a reload. Choose them again to check them and carry on."}
          </p>
          <Button variant="outline" onClick={onBack}>
            Choose files
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "failed") {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="flex items-start gap-3 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            {error}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={retry}>
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
            <Button variant="ghost" onClick={onBack}>
              Choose different files
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === "reading" || status === "checking" || status === "idle") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checking your files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "reading" && progress ? (
            <Progress value={Math.round(progress.ratio * 100)}>
              <ProgressLabel>Reading {progress.fileName}</ProgressLabel>
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                {formatCount(progress.records)} {progress.records === 1 ? "row" : "rows"}
              </span>
            </Progress>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" aria-hidden="true" />
              Checking the rows…
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Nothing has been uploaded yet. Your files are being read here, in this browser.
          </p>
        </CardContent>
      </Card>
    );
  }

  const held = blockers.length > 0 || pendingDecisions.length > 0;
  const continueLabel = blockers.length > 0
    ? "Fix the file before continuing"
    : pendingDecisions.length > 0
      ? "Answer the question above to continue"
      : totalFailingRows > 0
        ? `Continue — ${formatCount(totalFailingRows)} ${
            totalFailingRows === 1 ? "row" : "rows"
          } will fail`
        : "Continue";

  return (
    <div className="space-y-6">
      <PrecheckSummary
        files={pairs}
        blockers={blockers}
        pendingDecisions={pendingDecisions}
        totalWarnings={totalWarnings}
        totalFailingRows={totalFailingRows}
      />

      {pairs.map(({ inspection, findings: found }) => (
        <div key={inspection.kind} className="space-y-4">
          <HeaderDetectionCard
            inspection={inspection}
            skipHeader={skipHeader(inspection.kind)}
            overridden={headerOverridden(inspection.kind)}
            onSkipHeaderChange={(skip) => setSkipHeader(inspection.kind, skip)}
          />
          <DateFormatCard
            fileLabel={inspection.label}
            dates={found.dates}
            onChooseOrder={(column, order) => setDateOrder(inspection.kind, column, order)}
          />
          <PrecheckErrorsTable
            fileLabel={inspection.label}
            issues={found.issues}
            errorCount={found.errorCount}
            warningCount={found.warningCount}
            issuesTruncated={found.issuesTruncated}
          />
        </div>
      ))}

      {showProductMapping && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Loan products</CardTitle>
          </CardHeader>
          <CardContent>
            {runId === null ? (
              <p className="text-sm text-muted-foreground">
                Loan products can only be matched once the file has been uploaded and read by the
                server.
              </p>
            ) : (
              <>
                <ProductMappingGate
                  runId={runId}
                  onMapped={setMappingWarnings}
                  onMappingChange={setProductMap}
                />
                {mappingWarnings.length > 0 && (
                  <ul
                    role="status"
                    className="mt-3 list-inside list-disc space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                  >
                    {mappingWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* What the saved session cannot hold. A disclosure, not a blocker: this
          pass uploads from the per-file answers above, which are exact. */}
      {decided.collapsed.losses.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm"
        >
          <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">Worth knowing if you come back to this later</p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              {decided.collapsed.losses.map((loss) => (
                <li key={loss}>{loss}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!held && (
        <p className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
          Nothing has been uploaded yet — continuing starts the upload.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onBack}>
          Choose different files
        </Button>
        <Button onClick={handleConfirm} disabled={held}>
          {continueLabel}
          {!held && <ArrowRight aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
