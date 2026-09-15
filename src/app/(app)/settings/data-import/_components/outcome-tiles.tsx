"use client";

/**
 * What became of every row, said in a way an admin can act on.
 *
 * Two decisions carry this component.
 *
 * **`matched_existing` is its own tile, and it is informational.** This coop
 * already has 44 members who registered themselves and who therefore appear in
 * the migration file too. Those rows are matched to the member who already
 * exists, their loans are linked to that member, and no duplicate is created.
 * Reported under `skipped` — amber, next to `failed` — an admin reads that as
 * "44 members did not import", and the natural next move is to re-upload the
 * file to fix it, which is the one action that can do real damage. So the tile
 * is blue, it sits away from the warning colours, and the copy says outright
 * that the data landed.
 *
 * **The reconciliation is printed, and a total that does not add up says so.**
 * Six numbers that look plausible are indistinguishable from six numbers that
 * are right. The identity is
 *
 *     rows read = imported + matched + already imported + skipped + failed
 *
 * and while the run is open the shortfall is simply the rows the server has not
 * reached yet — it advances in batches about once a minute. Once the run is
 * closed every row has been decided (rows that failed validation at staging are
 * given `skipped` explicitly, for exactly this reason), so a shortfall then is
 * a fault and is rendered as one instead of being quietly absorbed.
 */

import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, FileText, Link2, RotateCcw, SkipForward, XCircle } from "lucide-react";
import type { ImportCounts, ImportFileKind } from "@/types/data-import";

/* ------------------------------------------------------------------ */
/* Pure — unit tested in ./outcome-tiles.test.ts                        */
/* ------------------------------------------------------------------ */

export interface CountsReconciliation {
  /** `counts.total` — the rows read out of the file. */
  total: number;
  /** The five outcome buckets added together. */
  decided: number;
  /** `total - decided`. Positive: rows not yet decided. Negative: impossible. */
  undecided: number;
  /** The identity holds exactly. */
  balanced: boolean;
  /** The parts exceed the whole — always a fault, whatever the phase. */
  overcounted: boolean;
}

export const RECONCILIATION_FORMULA =
  "rows read = imported + matched + already imported + skipped + failed";

export function reconcileCounts(counts: ImportCounts): CountsReconciliation {
  const n = (value: number | undefined): number =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  const total = n(counts.total);
  const decided =
    n(counts.imported) +
    n(counts.matched_existing) +
    n(counts.already_imported) +
    n(counts.skipped) +
    n(counts.failed);

  const undecided = total - decided;

  return {
    total,
    decided,
    undecided,
    balanced: undecided === 0,
    overcounted: undecided < 0,
  };
}

/** The identity, with this file's numbers in it. */
export function reconciliationLine(counts: ImportCounts): string {
  const { total } = reconcileCounts(counts);
  return (
    `${total.toLocaleString()} rows read = ` +
    `${counts.imported.toLocaleString()} imported + ` +
    `${counts.matched_existing.toLocaleString()} matched + ` +
    `${counts.already_imported.toLocaleString()} already imported + ` +
    `${counts.skipped.toLocaleString()} skipped + ` +
    `${counts.failed.toLocaleString()} failed`
  );
}

/* ------------------------------------------------------------------ */
/* Tiles                                                                */
/* ------------------------------------------------------------------ */

interface TileConfig {
  key: keyof ImportCounts;
  label: string;
  note: string;
  icon: typeof CheckCircle2;
  className: string;
  iconClassName: string;
}

const NEUTRAL = "border-border bg-muted/40";
const GOOD = "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-500/10";
/** Blue, not amber: this is news, not a warning. */
const INFO = "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-500/10";
const WARN = "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-500/10";
const BAD = "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-500/10";

function tilesFor(kind: ImportFileKind): TileConfig[] {
  const subject = kind === "loans" ? "loan" : "member";
  const matchedNote =
    kind === "loans"
      ? "Attached to a member who already existed in Lendyph. The loan was created and linked — nothing was duplicated, and this is not a failure."
      : "Matched a member who already existed in Lendyph — self-registered, most likely. Their loans were linked to that member, no duplicate was created, and this is not a failure.";

  return [
    {
      key: "total",
      label: "Rows read",
      note: "Data rows found in the file, header excluded.",
      icon: FileText,
      className: NEUTRAL,
      iconClassName: "text-muted-foreground",
    },
    {
      key: "imported",
      label: "Imported",
      note: `Created as a new ${subject}.`,
      icon: CheckCircle2,
      className: GOOD,
      iconClassName: "text-green-600 dark:text-green-400",
    },
    {
      key: "matched_existing",
      label: "Matched an existing member",
      note: matchedNote,
      icon: Link2,
      className: INFO,
      iconClassName: "text-sky-600 dark:text-sky-400",
    },
    {
      key: "already_imported",
      label: "Already imported",
      note: "Brought in by an earlier run of this same file. Nothing was written twice.",
      icon: RotateCcw,
      className: NEUTRAL,
      iconClassName: "text-muted-foreground",
    },
    {
      key: "skipped",
      label: "Skipped",
      note: "Not imported — the row did not pass validation, or there was nothing to import. See the report below.",
      icon: SkipForward,
      className: WARN,
      iconClassName: "text-amber-600 dark:text-amber-400",
    },
    {
      key: "failed",
      label: "Failed",
      note: "Tried and could not be written. See the report below.",
      icon: XCircle,
      className: BAD,
      iconClassName: "text-red-600 dark:text-red-400",
    },
  ];
}

export interface OutcomeTilesProps {
  counts: ImportCounts;
  /** Which file these counts belong to; decides the wording, not the layout. */
  kind: ImportFileKind;
  /** The original filename, shown beside the heading when known. */
  filename?: string | null;
  /**
   * `is_closed` from the run status — NOT a phase match. While the run is open
   * an undecided remainder is expected and is labelled as work outstanding;
   * once it is closed the same remainder is a fault.
   */
  runClosed: boolean;
  className?: string;
}

export function OutcomeTiles({
  counts,
  kind,
  filename,
  runClosed,
  className,
}: OutcomeTilesProps) {
  const reconciliation = reconcileCounts(counts);
  const tiles = tilesFor(kind);
  const heading = kind === "loans" ? "Loans" : "Members";
  const brokenArithmetic =
    reconciliation.overcounted || (runClosed && !reconciliation.balanced);

  return (
    <section className={cn("space-y-3", className)} aria-label={`${heading} outcome`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="font-heading text-base font-medium">{heading}</h3>
        {filename ? (
          <span className="text-sm text-muted-foreground break-all">{filename}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const value = counts[tile.key] ?? 0;
          return (
            <div
              key={tile.key}
              className={cn("rounded-lg border p-3", tile.className)}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn("size-4 shrink-0", tile.iconClassName)} aria-hidden="true" />
                <span className="text-xs font-medium text-muted-foreground">{tile.label}</span>
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {value.toLocaleString()}
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{tile.note}</p>
            </div>
          );
        })}
      </div>

      {/* The arithmetic, printed rather than implied. */}
      <p className="text-xs text-muted-foreground tabular-nums">
        {reconciliationLine(counts)}
      </p>

      {brokenArithmetic ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-200">
              These figures do not add up
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {reconciliation.overcounted
                ? `The outcomes total ${reconciliation.decided.toLocaleString()}, which is more than the ${reconciliation.total.toLocaleString()} rows read.`
                : `${Math.abs(reconciliation.undecided).toLocaleString()} of the ${reconciliation.total.toLocaleString()} rows read have no recorded outcome, and this run is finished.`}{" "}
              The identity that should hold is: {RECONCILIATION_FORMULA}. Treat the
              tiles above as unverified and report this before acting on them.
            </p>
          </div>
        </div>
      ) : !reconciliation.balanced ? (
        <p className="text-xs text-muted-foreground">
          {reconciliation.undecided.toLocaleString()} rows have not been reached
          yet. The server works through them in batches, about once a minute.
        </p>
      ) : null}
    </section>
  );
}
