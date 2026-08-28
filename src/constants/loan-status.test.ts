import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOAN_STATUS,
  LOAN_STATUS_COLORS,
  LOAN_STATUS_LABELS,
} from "./loan-status";
import type { LoanStatus } from "@/types/loan";

/**
 * Half of the guard is the type annotation, not these assertions.
 *
 * `LOAN_STATUS_LABELS` and `LOAN_STATUS_COLORS` are `Record<LoanStatus, string>`,
 * so a status added to the union without an entry in either map does not
 * compile — that failure lands in `npm run typecheck`, not here. What runs here
 * is the part the compiler cannot see: that the three declarations describe the
 * SAME set, so a status cannot be added to one and quietly missed by another.
 *
 * The annotation below is itself load-bearing. `Object.values(LOAN_STATUS)` is
 * typed from the `as const` object, so assigning it to `LoanStatus[]` stops
 * compiling the moment `LOAN_STATUS` gains a value the union does not have.
 * Together with the two `Record<LoanStatus, …>` maps and the key comparison
 * below, that pins all three to each other in both directions.
 */
const ALL_STATUSES: LoanStatus[] = Object.values(LOAN_STATUS);

const sorted = (values: string[]) => [...values].sort();

test("every status in LOAN_STATUS has a label", () => {
  assert.deepEqual(sorted(Object.keys(LOAN_STATUS_LABELS)), sorted(ALL_STATUSES));
});

test("every status in LOAN_STATUS has a badge colour", () => {
  assert.deepEqual(sorted(Object.keys(LOAN_STATUS_COLORS)), sorted(ALL_STATUSES));
});

test("labels and colours cover exactly the same statuses", () => {
  // The two `statusColors` copies this replaces had already drifted: the loan
  // detail page's was missing `ongoing`, so a released loan on a schedule drew
  // an unstyled badge on the one screen you open to check it.
  assert.deepEqual(
    sorted(Object.keys(LOAN_STATUS_LABELS)),
    sorted(Object.keys(LOAN_STATUS_COLORS))
  );
});

test("no status renders a blank label or an unstyled pill", () => {
  for (const status of ALL_STATUSES) {
    assert.ok(
      LOAN_STATUS_LABELS[status]?.trim(),
      `${status} has no label — the badge would fall back to the raw enum value`
    );
    assert.ok(
      LOAN_STATUS_COLORS[status]?.trim(),
      `${status} has no colour — the badge would render className={undefined}`
    );
  }
});

// ── void ───────────────────────────────────────────────────────────────────
//
// The status that started this. `LoanService::voidLoan()` has set it for
// months and `LoanController::index()` reports a count for it, but no frontend
// map had a key for it, so a voided loan drew an unstyled pill reading "void".

test("a voided loan has a human label, not the raw enum value", () => {
  assert.equal(LOAN_STATUS_LABELS.void, "Voided");
});

test("a voided loan has badge classes", () => {
  assert.ok(LOAN_STATUS_COLORS.void.includes("line-through"));
  assert.ok(LOAN_STATUS_COLORS.void.includes("bg-"));
  assert.ok(LOAN_STATUS_COLORS.void.includes("text-"));
});

test("`void` survives being an object key and a lookup", () => {
  // A reserved WORD, not a reserved property name or string literal type. This
  // is the assumption that kept it out of the maps, asserted rather than
  // trusted: dot access, computed access off a `LoanStatus`, and `in`.
  const status: LoanStatus = "void";
  assert.equal(LOAN_STATUS_COLORS[status], LOAN_STATUS_COLORS.void);
  assert.ok("void" in LOAN_STATUS_LABELS);
  assert.equal(LOAN_STATUS.VOID, "void");
});

// ── the legacy statuses the maps must keep ─────────────────────────────────

test("the legacy `ongoing` status is still labelled and styled", () => {
  // Older backends emit it, and it is what the "Current" filter tab sends.
  assert.equal(LOAN_STATUS_LABELS.ongoing, "Current");
  assert.equal(LOAN_STATUS_COLORS.ongoing, LOAN_STATUS_COLORS.current);
});
