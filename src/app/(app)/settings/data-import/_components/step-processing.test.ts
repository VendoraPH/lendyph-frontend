import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatElapsed,
  isStale,
  phaseLabel,
  rowProgress,
  STALE_AFTER_SECONDS,
} from "./step-processing";
import type { ImportCounts } from "@/types/data-import";

/**
 * A counts block for a CLOSED run.
 *
 * The outcome buckets start at zero because each test names the ones it is
 * about. The staging verdicts do not: they track `total`, because a closed run
 * has staged every row and settled every verdict, and `pending` above zero is
 * precisely the state in which the buckets are NOT expected to reconcile
 * against `total`. A test about a run still in flight says so by overriding
 * them.
 */
function counts(overrides: Partial<ImportCounts> = {}): ImportCounts {
  const total = overrides.total ?? 0;
  return {
    total,
    valid: total,
    invalid: 0,
    pending: 0,
    imported: 0,
    matched_existing: 0,
    already_imported: 0,
    skipped: 0,
    failed: 0,
    ...overrides,
  };
}

/* ── phase labels ───────────────────────────────────────────────────── */

test("every phase is named for what is happening, not 'Processing…'", () => {
  assert.equal(phaseLabel("importing_customers"), "Creating members");
  assert.equal(phaseLabel("importing_loans"), "Creating loans");
  assert.equal(phaseLabel("staging"), "Reading the rows out of your files");
  assert.equal(phaseLabel("awaiting_mapping"), "Waiting for you to confirm the loan products");
  assert.equal(phaseLabel("cancelled"), "Cancelled");
});

test("a phase nobody has written copy for is still readable", () => {
  // `cancelled` was added after this screen was first written. An exhaustive
  // match is what turned that into a blank panel, so an unknown phase is
  // humanised rather than dropped.
  assert.equal(phaseLabel("reconciling_share_capital"), "Reconciling share capital");
  assert.equal(phaseLabel("rolling-back"), "Rolling back");
});

test("no phase at all still says something", () => {
  assert.equal(phaseLabel(null), "Working");
  assert.equal(phaseLabel(undefined), "Working");
  assert.equal(phaseLabel(""), "Working");
});

/* ── the determinate bar ────────────────────────────────────────────── */

test("progress is rows decided over rows staged, across both files", () => {
  const progress = rowProgress({
    customers: { counts: counts({ total: 44, imported: 20, matched_existing: 4 }) },
    loans: { counts: counts({ total: 60, imported: 30, failed: 2 }) },
  });
  assert.equal(progress.total, 104);
  assert.equal(progress.processed, 56);
  assert.equal(progress.percent, (56 / 104) * 100);
});

test("with nothing staged there is no bar rather than a bar at zero forever", () => {
  // A denominator of zero is not 0% — it is "we do not know yet", and a bar
  // pinned at the left reads as an import that has stalled.
  assert.equal(rowProgress({}).percent, null);
  assert.equal(rowProgress(undefined).percent, null);
  assert.equal(rowProgress({ customers: { counts: counts() } }).percent, null);
});

test("a file block with no counts is ignored rather than counted as zero rows", () => {
  const progress = rowProgress({
    customers: { counts: counts({ total: 10, imported: 10 }) },
    loans: {},
  });
  assert.equal(progress.total, 10);
  assert.equal(progress.percent, 100);
});

test("the bar cannot run past its end", () => {
  const progress = rowProgress({
    customers: { counts: counts({ total: 10, imported: 12, failed: 3 }) },
  });
  assert.equal(progress.percent, 100);
});

/* ── the server's clock ─────────────────────────────────────────────── */

test("elapsed time is formatted from the server's own seconds", () => {
  assert.equal(formatElapsed(0), "0s");
  assert.equal(formatElapsed(45), "45s");
  assert.equal(formatElapsed(65), "1m 05s");
  assert.equal(formatElapsed(185), "3m 05s");
  assert.equal(formatElapsed(3_840), "1h 04m");
});

test("a run that has never reported a clock shows none, rather than showing zero", () => {
  // `seconds_since_last_advance` is nullable. "0s ago" would be a claim the
  // server did not make.
  assert.equal(formatElapsed(null), null);
  assert.equal(formatElapsed(undefined), null);
  assert.equal(formatElapsed(-5), null);
  assert.equal(formatElapsed(Number.NaN), null);
});

test("staleness is measured against a stated threshold, not felt", () => {
  assert.equal(isStale(60), false);
  assert.equal(isStale(STALE_AFTER_SECONDS), false);
  assert.equal(isStale(STALE_AFTER_SECONDS + 1), true);
  assert.equal(isStale(null), false);
  assert.equal(isStale(undefined), false);
});

test("the threshold is comfortably longer than the server's own batch interval", () => {
  // Batches land about once a minute, so anything under two minutes would cry
  // wolf on a perfectly healthy run.
  assert.ok(STALE_AFTER_SECONDS >= 120);
});
