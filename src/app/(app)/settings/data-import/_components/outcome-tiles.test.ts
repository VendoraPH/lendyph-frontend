import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileCounts, reconciliationFormula, reconciliationLine, RECONCILIATION_FORMULA, tilesFor } from "./outcome-tiles";
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

test("a finished run where every row is accounted for balances", () => {
  // The coop's real shape: 44 members, 12 of whom had already registered
  // themselves and are matched rather than duplicated.
  const result = reconcileCounts(
    counts({ total: 44, imported: 30, matched_existing: 12, skipped: 1, failed: 1 }),
  );
  assert.equal(result.decided, 44);
  assert.equal(result.undecided, 0);
  assert.equal(result.balanced, true);
  assert.equal(result.overcounted, false);
});

test("matched rows count towards the total — they are not a kind of skipped", () => {
  // If `matched_existing` were folded into `skipped` this would still balance,
  // which is exactly why the separation has to be in the contract and not in
  // the arithmetic.
  const withMatches = reconcileCounts(counts({ total: 44, imported: 32, matched_existing: 12 }));
  assert.equal(withMatches.balanced, true);

  const ifMatchesWereDropped = reconcileCounts(counts({ total: 44, imported: 32 }));
  assert.equal(ifMatchesWereDropped.balanced, false);
  assert.equal(ifMatchesWereDropped.undecided, 12);
});

test("a run still working reports the remainder as rows not yet decided", () => {
  const midway = reconcileCounts(counts({ total: 44, imported: 10, matched_existing: 2 }));
  assert.equal(midway.decided, 12);
  assert.equal(midway.undecided, 32);
  assert.equal(midway.balanced, false);
  assert.equal(midway.overcounted, false);
});

test("parts that exceed the whole are a fault whatever the phase", () => {
  // Double-counting one bucket is the failure this exists to catch: six
  // plausible tiles that quietly describe more rows than the file contains.
  const broken = reconcileCounts(
    counts({ total: 44, imported: 30, matched_existing: 12, already_imported: 12 }),
  );
  assert.equal(broken.overcounted, true);
  assert.equal(broken.undecided, -10);
  assert.equal(broken.balanced, false);
});

test("an empty file is balanced rather than broken", () => {
  const empty = reconcileCounts(counts());
  assert.equal(empty.balanced, true);
  assert.equal(empty.total, 0);
});

test("a missing or non-numeric count reads as zero rather than poisoning the sum", () => {
  const missing = reconcileCounts({
    total: 10,
    imported: 10,
  } as unknown as ImportCounts);
  assert.equal(missing.decided, 10);
  assert.equal(missing.balanced, true);

  const nonsense = reconcileCounts(
    counts({ total: 10, imported: Number.NaN as unknown as number }),
  );
  assert.equal(Number.isFinite(nonsense.decided), true);
});

test("the printed line names every term of the identity", () => {
  const line = reconciliationLine(
    counts({ total: 44, imported: 30, matched_existing: 12, skipped: 1, failed: 1 }),
  );
  assert.match(line, /44 rows read/);
  assert.match(line, /30 imported/);
  assert.match(line, /12 matched/);
  assert.match(line, /0 already imported/);
  assert.match(line, /1 skipped/);
  assert.match(line, /1 failed/);
});

test("the formula is stated in the same terms the tiles use", () => {
  for (const term of ["imported", "matched", "already imported", "skipped", "failed"]) {
    assert.ok(RECONCILIATION_FORMULA.includes(term), `formula is missing "${term}"`);
  }
});

test("one row read reads in the singular", () => {
  const line = reconciliationLine(counts({ total: 1, imported: 1 }));
  assert.match(line, /^1 row read = /);
});

test("share capital rows read as ledger entries, with no member to match", () => {
  const tiles = tilesFor("share_capital");

  assert.deepEqual(tiles.map((tile) => tile.key), ["total", "imported", "already_imported", "skipped", "failed"]);
  assert.equal(tiles.find((tile) => tile.key === "imported")?.note, "Added to the member's share capital ledger, marked imported.");
  assert.equal(
    tiles.find((tile) => tile.key === "skipped")?.note,
    "Not imported: the row didn't pass the checks, or it repeats an entry already on the ledger. See the report below.",
  );
  assert.equal(tiles.find((tile) => tile.key === "already_imported")?.note, "Brought in by an earlier import. Nothing was written twice.");
  for (const tile of tiles) assert.doesNotMatch(tile.note, /[Bb]orrower|_/);

  assert.ok(tilesFor("customers").some((tile) => tile.key === "matched_existing"), "members still match");
});

test("a share capital file's line and formula have no matched figure, as it has no Matched tile", () => {
  const line = reconciliationLine(counts({ total: 4, imported: 3, skipped: 1 }), "share_capital");
  assert.equal(line, "4 rows read = 3 imported + 0 already imported + 1 skipped + 0 failed");
  assert.doesNotMatch(reconciliationFormula("share_capital"), /matched/);
  assert.equal(reconciliationFormula("share_capital"), "rows read = imported + already imported + skipped + failed");

  // The members and loans files keep theirs.
  assert.match(reconciliationLine(counts({ total: 1, imported: 1 }), "customers"), /0 matched/);
  assert.equal(reconciliationFormula("loans"), RECONCILIATION_FORMULA);
});
