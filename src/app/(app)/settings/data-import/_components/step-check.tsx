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
import { columnsFor } from "@/lib/import-schema";
import { loadImportSession, type ImportSession } from "@/lib/import-session";
import { formatCount } from "@/lib/report-format";
import type { ImportFileKind } from "@/types/data-import";
import {
  FILE_LABELS,
  SHAPE_BY_KIND,
  sessionAnswers,
  useFilePrecheck,
  type FileFindings,
  type FileInspection,
  type FileSessionAnswer,
} from "../_hooks/use-file-precheck";
import { DateFormatCard } from "./date-format-card";
import { HeaderDetectionCard } from "./header-detection-card";
import { PrecheckErrorsTable } from "./precheck-errors-table";
import { PrecheckSummary } from "./precheck-summary";
import { ProductMappingGate } from "./product-mapping-table";

// ---------------------------------------------------------------------------
// The contract with the shell
// ---------------------------------------------------------------------------

// `ImportFiles` and `PrecheckOutcome` are owned by ./data-import-view, which
// holds the wizard's shared vocabulary. This file used to declare its own
// `ImportFiles` — a same-named near-twin that also admitted `undefined` and
// made both keys optional — and two types with one name that differ in
// nullability is how a null reaches somewhere that never expected one. The
// variance was never load-bearing here: the only thing this file does with the
// prop is hand it to `useFilePrecheck`, whose PARAMETER is the wide shape, and
// the shell's narrower type satisfies it unchanged.
import type { ImportFiles, PrecheckOutcome } from "./data-import-view";

/**
 * What the pre-check found out about ONE file, beyond the answers themselves.
 *
 * The answers — which file has a header row, how each date column reads — are
 * NOT here. They travel in `PrecheckOutcome`, which is keyed per file and, for
 * dates, per column, and is the thing that gets persisted. Carrying them in
 * both arguments would be the same fact in two shapes, which is how the two
 * come to disagree.
 *
 * What is left is evidence: what the file turned out to be, how much of it was
 * checked, and whether the header answer is the admin's or the detector's. A
 * consumer wanting the answer for a file reads `outcome.hasHeaderRow[kind]`;
 * this says whether to believe the detector about it.
 */
export interface FilePrecheckDecision {
  /** True when the header answer is the admin's rather than the detected one. */
  headerOverridden: boolean;
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
   *  per-file evidence to report and inventing some would be worse than none. */
  files: Partial<Record<ImportFileKind, FilePrecheckDecision>>;
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
   * The first argument carries the answers, per file — and per column for
   * dates — in exactly the shape `ImportSession` persists. The second carries
   * the per-file EVIDENCE behind them; nothing is required to read it, and a
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

/** One file's saved answers, read back for the resumed panel. */
export interface StoredFileAnswer {
  kind: ImportFileKind;
  label: string;
  /** `null` when the record holds no answer for this file. Never `false`. */
  skipHeaderRow: boolean | null;
  dateColumns: Array<{ column: string; label: string; pattern: string }>;
}

/**
 * The saved answers, per file, in the order the files are uploaded.
 *
 * Both `hasHeaderRow` and `dateFormat` are keyed per file precisely so that a
 * MISSING key can mean "not answered", and this is the one screen where that
 * distinction is read by a human before they confirm — so it survives to the
 * page as `null` rather than being flattened into `false`. Rendering an unasked
 * question as "Row 1 is imported" is how a heading ends up in the member list
 * with the admin's own agreement.
 *
 * Date columns are shown under the labels from the client's own workbook, since
 * `date_released` is our word for that column and "Date Released" is theirs.
 */
export function storedAnswers(session: ImportSession): StoredFileAnswer[] {
  return FILE_ORDER.filter(
    (kind) =>
      kind in session.hasHeaderRow ||
      kind in session.dateFormat ||
      kind in session.files,
  ).map((kind) => {
    const labels = new Map(
      columnsFor(SHAPE_BY_KIND[kind]).map((column) => [column.key, column.label]),
    );
    return {
      kind,
      label: FILE_LABELS[kind],
      skipHeaderRow: session.hasHeaderRow[kind] ?? null,
      dateColumns: Object.entries(session.dateFormat[kind] ?? {}).map(
        ([column, pattern]) => ({
          column,
          label: labels.get(column) ?? column,
          pattern,
        }),
      ),
    };
  });
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

  /**
   * The answers and the evidence, both keyed per file.
   *
   * One pass builds both from the same source, so they cannot drift: the
   * answers go out as `PrecheckOutcome` in the shape the session stores, the
   * evidence as `PrecheckDecisions`. Nothing is collapsed on the way — a
   * header row is asked per file because it IS per file, and a date order per
   * column because that is where it is settled.
   */
  const decided = useMemo(() => {
    const perFile: Partial<Record<ImportFileKind, FilePrecheckDecision>> = {};
    const perFileAnswers: FileSessionAnswer[] = [];

    for (const { inspection, findings: found } of pairs) {
      const dateOrders: Record<string, DateOrder | null> = {};
      for (const date of found.dates) {
        // `undefined` cannot reach here: Continue stays disabled while any
        // column is unsettled, and a blocked column is a blocker.
        dateOrders[date.key] = date.order ?? null;
      }

      perFileAnswers.push({
        kind: inspection.kind,
        skipHeaderRow: skipHeader(inspection.kind),
        dateOrders,
      });

      perFile[inspection.kind] = {
        headerOverridden: headerOverridden(inspection.kind),
        delimiter: inspection.delimiter,
        rowCount: found.totalRows,
        columnCount: inspection.widths[0]?.columns ?? 0,
        failingRows: found.failingRows,
        warnings: found.warningCount,
        rowsNotChecked: found.rowsNotChecked,
      };
    }

    return { perFile, answers: sessionAnswers(perFileAnswers) };
  }, [pairs, skipHeader, headerOverridden]);

  const handleConfirm = useCallback(() => {
    onConfirm(
      {
        hasHeaderRow: decided.answers.hasHeaderRow,
        dateFormat: decided.answers.dateFormat,
        productMap,
      },
      { runId, files: decided.perFile },
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

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
              {storedAnswers(stored).map((answer) => (
                <div key={answer.kind} className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4">
                  <p className="font-medium">{answer.label}</p>
                  <div className="space-y-1 text-muted-foreground">
                    <p>
                      {answer.skipHeaderRow === null ? (
                        // Never rendered as "Row 1 is imported". A file nobody
                        // was asked about is not a file answered "no header",
                        // and showing the two the same way is what makes an
                        // admin confirm a heading into the member list.
                        <span className="text-amber-700 dark:text-amber-500">
                          Header row — not answered for this file
                        </span>
                      ) : answer.skipHeaderRow ? (
                        "Row 1 is skipped as a heading"
                      ) : (
                        "Row 1 is imported as data"
                      )}
                    </p>
                    {answer.dateColumns.length > 0 ? (
                      <ul className="space-y-0.5">
                        {answer.dateColumns.map(({ column, label, pattern }) => (
                          <li key={column}>
                            {label} read as <span className="font-mono">{pattern}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No date column needed an answer</p>
                    )}
                  </div>
                </div>
              ))}

              <div className="grid gap-1 border-t pt-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
                <p className="font-medium">Loan products mapped</p>
                <p className="text-muted-foreground tabular-nums">{formatCount(mapped)}</p>
              </div>
            </div>

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
                    // No per-file evidence: the files were never re-read, and
                    // inventing some would be worse than reporting none. The
                    // ANSWERS above are per file already — they come straight
                    // off the record, which is keyed that way.
                    { runId, files: {} },
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
