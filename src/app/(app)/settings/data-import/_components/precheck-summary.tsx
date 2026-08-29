"use client";

/**
 * What the pre-check found, before the admin reads a single row.
 *
 * Three things this is careful about, each because the careless version is
 * actively misleading:
 *
 *  - **Encoding notices are file-level, never row-level.** A Windows-1252
 *    export makes `Peña` look like `Pe?a` in this browser, but the server reads
 *    the ORIGINAL bytes and converts them, so those rows import correctly.
 *    Listing them as damaged rows tells an admin their data is bad when it is
 *    not, on the one screen whose whole job is to be believed.
 *
 *  - **Row counts are from the complete parse.** The heading says how many rows
 *    the file has; the checks may have covered fewer, and when they have, that
 *    shortfall is stated here rather than left for the row table to imply.
 *
 *  - **Failures and warnings are separate totals and never merge.** A contact
 *    cell holding two numbers, or a loan whose member is already in Lendyph,
 *    are warnings. Rolling them into "27 problems" is how an admin ends up
 *    hand-editing rows the importer would have taken.
 */

import { AlertTriangle, CircleAlert, FileSpreadsheet, HelpCircle, Info, ShieldCheck } from "lucide-react";
import { formatCount } from "@/lib/report-format";
import { cn } from "@/lib/utils";
import type { FileFindings, FileInspection } from "../_hooks/use-file-precheck";

export interface PrecheckFileSummary {
  inspection: FileInspection;
  findings: FileFindings;
}

export interface PrecheckSummaryProps {
  files: readonly PrecheckFileSummary[];
  /** Reasons the import cannot run. Non-empty means Continue is disabled. */
  blockers: readonly string[];
  /** Questions only the admin can answer. Also holds up Continue. */
  pendingDecisions: readonly string[];
  totalWarnings: number;
  /** Rows carrying at least one error. Never includes warning-only rows. */
  totalFailingRows: number;
}

function megabytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium tabular-nums">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: "danger" | "warning" | "info" | "ok";
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  const tones = {
    danger: "border-destructive/40 bg-destructive/5",
    warning: "border-amber-500/40 bg-amber-500/10",
    info: "bg-muted/40",
    ok: "border-emerald-500/40 bg-emerald-500/10",
  } as const;

  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : undefined}
      className={cn("flex items-start gap-3 rounded-lg border p-4", tones[tone])}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </div>
  );
}

function FileSummary({ inspection, findings }: PrecheckFileSummary) {
  const { widths, expectedColumns } = inspection;
  const found = widths[0]?.columns ?? 0;

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h3 className="truncate text-sm font-semibold">{inspection.label}</h3>
        <span className="truncate text-xs text-muted-foreground">{inspection.fileName}</span>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Rows to import"
          value={formatCount(findings.totalRows)}
          hint={
            findings.rowsNotChecked > 0
              ? `${formatCount(findings.checkedRows)} checked`
              : "all checked"
          }
        />
        <Stat
          label="Columns"
          value={`${found} of ${expectedColumns}`}
          hint={found === expectedColumns ? "as expected" : "does not match"}
        />
        <Stat
          label="Separator"
          value={inspection.delimiterDetected ? inspection.delimiterLabel : "none found"}
          hint={
            inspection.delimiterDetected
              ? `from ${formatCount(inspection.delimiterRows)} sampled ${
                  inspection.delimiterRows === 1 ? "row" : "rows"
                }`
              : "read as one column"
          }
        />
        <Stat label="File size" value={megabytes(inspection.sizeBytes)} />
      </dl>

      {/* Notices come out of the reader one per FILE, never per row. Rendered
          as they arrive so a code added later still reaches the admin. */}
      {inspection.notices.length > 0 && (
        <ul className="mt-3 space-y-2">
          {inspection.notices.map((notice) => (
            <li
              key={notice.code}
              className={cn(
                "flex items-start gap-2 rounded-lg border p-3 text-sm",
                notice.severity === "error"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-amber-500/40 bg-amber-500/10",
              )}
            >
              {notice.severity === "error" ? (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
              )}
              <span>{notice.message}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Above the ceiling the checks are partial, and saying nothing here is
          the same as reporting a clean file that was never looked at. */}
      {findings.rowsNotChecked > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>
            Row checks cover the first {formatCount(findings.checkedRows)} of{" "}
            {formatCount(findings.totalRows)} rows. The remaining{" "}
            {formatCount(findings.rowsNotChecked)} were not checked here — they will still be
            imported, and any problems in them appear in the error report afterwards. The date
            format above was read from every row.
          </span>
        </p>
      )}
    </div>
  );
}

export function PrecheckSummary({
  files,
  blockers,
  pendingDecisions,
  totalWarnings,
  totalFailingRows,
}: PrecheckSummaryProps) {
  const totalRows = files.reduce((sum, file) => sum + file.findings.totalRows, 0);
  const blocked = blockers.length > 0;
  const clean = !blocked && totalFailingRows === 0;

  return (
    <div className="space-y-4">
      {blockers.length > 0 && (
        <Banner
          tone="danger"
          icon={<CircleAlert className="size-5 text-destructive" />}
          title={
            blockers.length === 1
              ? "This file cannot be imported as it stands"
              : `${blockers.length} things stop this import from running`
          }
        >
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </Banner>
      )}

      {pendingDecisions.length > 0 && (
        <Banner
          tone="warning"
          icon={<HelpCircle className="size-5 text-amber-600" />}
          title="We need you to decide something first"
        >
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            {pendingDecisions.map((decision) => (
              <li key={decision}>{decision}</li>
            ))}
          </ul>
        </Banner>
      )}

      {files.map((file) => (
        <FileSummary key={file.inspection.kind} {...file} />
      ))}

      {/* Failures and warnings, side by side and never added together. */}
      {clean && totalWarnings === 0 ? (
        <Banner
          tone="ok"
          icon={<ShieldCheck className="size-5 text-emerald-600" />}
          title={`No problems found in ${formatCount(totalRows)} ${totalRows === 1 ? "row" : "rows"}.`}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* With a blocker outstanding the row verdict is moot, and a green
              "no rows will fail" beside "this file cannot be imported" reads
              as a contradiction. State the row result without the
              reassurance. */}
          <Banner
            tone={totalFailingRows > 0 ? "danger" : blocked ? "info" : "ok"}
            icon={
              totalFailingRows > 0 ? (
                <CircleAlert className="size-5 text-destructive" />
              ) : blocked ? (
                <Info className="size-5 text-muted-foreground" />
              ) : (
                <ShieldCheck className="size-5 text-emerald-600" />
              )
            }
            title={
              totalFailingRows > 0
                ? `${formatCount(totalFailingRows)} ${
                    totalFailingRows === 1 ? "row will fail" : "rows will fail"
                  }`
                : blocked
                  ? "No individual row failed the checks"
                  : "No rows will fail"
            }
          >
            <p className="text-muted-foreground">
              {totalFailingRows > 0
                ? "These rows will be skipped and listed in the error report. Everything else still imports."
                : blocked
                  ? "That does not make the file importable — the problems above apply to the whole file."
                  : "Every row checked has the values the import needs."}
            </p>
          </Banner>

          <Banner
            tone={totalWarnings > 0 ? "warning" : "info"}
            icon={
              totalWarnings > 0 ? (
                <AlertTriangle className="size-5 text-amber-600" />
              ) : (
                <Info className="size-5 text-muted-foreground" />
              )
            }
            title={`${formatCount(totalWarnings)} ${totalWarnings === 1 ? "warning" : "warnings"}`}
          >
            <p className="text-muted-foreground">
              {totalWarnings > 0
                ? "These rows import. The import repairs or matches the value; the note is so you know what it did."
                : "Nothing needs your attention beyond the rows above."}
            </p>
          </Banner>
        </div>
      )}
    </div>
  );
}
