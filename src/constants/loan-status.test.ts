import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACTIVE_LOAN_STATUSES,
  COLLECTIBLE_LOAN_STATUSES,
  EVER_RELEASED_LOAN_STATUSES,
  isActiveLoanStatus,
  isCollectibleLoanStatus,
  isEverReleasedLoanStatus,
  LOAN_STATUS,
  LOAN_STATUS_COLORS,
  LOAN_STATUS_LABELS,
  loanDisplayStatus,
  loanRowStatusLabel,
  loanStatusLabel,
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

test("a released loan reads Current, the same as an ongoing one (decision 5a)", () => {
  // `loans.status` keeps both values; only the wording is shared, and so is
  // the pill, so one word never comes in two colours.
  assert.equal(LOAN_STATUS_LABELS.released, "Current");
  assert.equal(loanStatusLabel("released"), "Current");
  assert.equal(LOAN_STATUS_LABELS.released, LOAN_STATUS_LABELS.ongoing);
  assert.equal(LOAN_STATUS_COLORS.released, LOAN_STATUS_COLORS.ongoing);
});

// ── the active / inactive partition ────────────────────────────────────────
//
// The printables loan picker filters a member's loans by it, and "active" is
// the default view — a status that falls out of the partition silently
// disappears from the list staff print from.

test("every status is either active or inactive, and never both", () => {
  const active = ALL_STATUSES.filter(isActiveLoanStatus);
  const inactive = ALL_STATUSES.filter((s) => !isActiveLoanStatus(s));
  assert.equal(active.length + inactive.length, ALL_STATUSES.length);
  assert.deepEqual(sorted(active), sorted([...ACTIVE_LOAN_STATUSES]));
});

test("a released loan on a schedule is active under either spelling", () => {
  // `ongoing` is the legacy spelling of `current`; a backend still emitting it
  // must not park live loans in the "Closed" tab.
  assert.ok(isActiveLoanStatus(LOAN_STATUS.CURRENT));
  assert.ok(isActiveLoanStatus(LOAN_STATUS.ONGOING));
  assert.ok(isActiveLoanStatus(LOAN_STATUS.RELEASED));
  assert.ok(isActiveLoanStatus(LOAN_STATUS.PAST_DUE));
});

test("loans that never released, and loans that finished, are inactive", () => {
  for (const status of [
    LOAN_STATUS.DRAFT,
    LOAN_STATUS.FOR_REVIEW,
    LOAN_STATUS.APPROVED,
    LOAN_STATUS.REJECTED,
    LOAN_STATUS.VOID,
    LOAN_STATUS.COMPLETED,
    LOAN_STATUS.DEFAULTED,
    LOAN_STATUS.RESTRUCTURED,
    LOAN_STATUS.CLOSED,
  ]) {
    assert.equal(isActiveLoanStatus(status), false, `${status} should be inactive`);
  }
});

test("an unknown or absent status reads as inactive rather than throwing", () => {
  // List rows come off the API; a status the union has not caught up with
  // should fall out of the "Active" tab, not break the filter.
  assert.equal(isActiveLoanStatus(undefined), false);
  assert.equal(isActiveLoanStatus(null), false);
  assert.equal(isActiveLoanStatus(""), false);
  assert.equal(isActiveLoanStatus("some_future_status"), false);
});

// ── the collectible set ────────────────────────────────────────────────────
//
// Active means a current loan. A defaulted loan is not active, but it is still
// owed: the server's collectible loans (released, ongoing, defaulted).

test("the collectible set is released, ongoing and defaulted", () => {
  assert.deepEqual([...COLLECTIBLE_LOAN_STATUSES], ["released", "ongoing", "defaulted"]);
});

test("a defaulted loan is collectible but not active", () => {
  assert.equal(isCollectibleLoanStatus(LOAN_STATUS.DEFAULTED), true);
  assert.equal(isActiveLoanStatus(LOAN_STATUS.DEFAULTED), false);
});

test("every collectible status the enum holds, except defaulted, is active", () => {
  for (const status of COLLECTIBLE_LOAN_STATUSES) {
    if (status === LOAN_STATUS.DEFAULTED) continue;
    assert.ok(isActiveLoanStatus(status), status);
  }
});

test("finished, never-released and unknown statuses are not collectible", () => {
  for (const status of ["draft", "for_review", "approved", "rejected", "void", "completed", "restructured", "closed"]) {
    assert.equal(isCollectibleLoanStatus(status), false, status);
  }
  assert.equal(isCollectibleLoanStatus(undefined), false);
  assert.equal(isCollectibleLoanStatus(null), false);
  assert.equal(isCollectibleLoanStatus("some_future_status"), false);
});

// ── the ever-released set ──────────────────────────────────────────────────
//
// The loan detail page reads the persisted schedule, repayments and ledger for
// exactly these, and the restructure link picks the child loan in one of them.

test("the ever-released set is the backend's Loan::EVER_RELEASED_STATUSES", () => {
  assert.deepEqual(
    [...EVER_RELEASED_LOAN_STATUSES],
    ["released", "ongoing", "completed", "defaulted", "restructured"]
  );
});

test("statuses the loans.status enum cannot hold are not ever-released", () => {
  // Kept in the union for old payloads only; listing them made every copy of
  // this set on the loan page longer than the enum it described.
  for (const status of [LOAN_STATUS.CURRENT, LOAN_STATUS.PAST_DUE, LOAN_STATUS.CLOSED]) {
    assert.equal(isEverReleasedLoanStatus(status), false, `${status} is not in the enum`);
  }
});

test("a loan that never released is not ever-released", () => {
  for (const status of [
    LOAN_STATUS.DRAFT,
    LOAN_STATUS.FOR_REVIEW,
    LOAN_STATUS.APPROVED,
    LOAN_STATUS.REJECTED,
    LOAN_STATUS.VOID,
  ]) {
    assert.equal(isEverReleasedLoanStatus(status), false, `${status} never released`);
  }
  assert.equal(isEverReleasedLoanStatus(undefined), false);
  assert.equal(isEverReleasedLoanStatus(null), false);
  assert.equal(isEverReleasedLoanStatus(""), false);
});

test("a loan under approval reads \"For Approval\", with its approving officer when known", () => {
  assert.equal(LOAN_STATUS_LABELS.for_review, "For Approval");
  assert.equal(loanStatusLabel("for_review", "Manager"), "For Approval - Manager");
  assert.equal(loanStatusLabel("for_review", "  Manager "), "For Approval - Manager");
  assert.equal(loanStatusLabel("for_review", null), "For Approval");
  assert.equal(loanStatusLabel("for_review", "  "), "For Approval");
  assert.equal(loanStatusLabel("for_review"), "For Approval");
});

test("only For Approval carries an approver suffix", () => {
  assert.equal(loanStatusLabel("approved", "Manager"), "Approved");
  assert.equal(loanStatusLabel("draft", "Manager"), "Draft");
});

// The approval step's Status is what the loan shows while it waits at that
// step. The backend sends it as `current_status_label`; a step without one
// falls back to the step (approver) name, as before.
test("a loan waiting at a step with a Status shows that Status", () => {
  assert.equal(
    loanStatusLabel("for_review", "Manager", "Credit Check"),
    "For Approval - Credit Check",
  );
  assert.equal(
    loanStatusLabel("for_review", null, "  Credit Check "),
    "For Approval - Credit Check",
  );
});

test("a step without a Status falls back to the step name", () => {
  assert.equal(loanStatusLabel("for_review", "Manager", null), "For Approval - Manager");
  assert.equal(loanStatusLabel("for_review", "Manager", "   "), "For Approval - Manager");
  assert.equal(loanStatusLabel("for_review", null, null), "For Approval");
});

test("a step Status relabels only a loan under approval or awaiting release", () => {
  assert.equal(loanStatusLabel("approved", "Manager", "Credit Check"), "Approved - Credit Check");
  assert.equal(loanStatusLabel("released", null, "Credit Check"), "Current");
});

// ── the label at the Release step ──────────────────────────────────────────

test("an approved loan reads the Release step's Status when it has one", () => {
  assert.equal(loanStatusLabel("approved", null, "Ready for Release"), "Approved - Ready for Release");
});

test("an approved loan with no Status reads plain Approved, never the approver", () => {
  assert.equal(loanStatusLabel("approved"), "Approved");
  assert.equal(loanStatusLabel("approved", null, "   "), "Approved");
  assert.equal(loanStatusLabel("approved", "Release Officer", null), "Approved");
});

test("a loan under approval keeps its step Status, then its approver", () => {
  assert.equal(loanStatusLabel("for_review", "Manager", "Credit Check"), "For Approval - Credit Check");
  assert.equal(loanStatusLabel("for_review", "Manager", null), "For Approval - Manager");
  assert.equal(loanStatusLabel("for_review"), "For Approval");
});

// ── the status a loan shows ────────────────────────────────────────────────

test("a loan past grace shows the server's display_status, in red", () => {
  const display = loanDisplayStatus({ status: "ongoing", display_status: "past_due" });
  assert.equal(display, "past_due");
  assert.equal(LOAN_STATUS_LABELS[display], "Past Due");
  assert.ok(LOAN_STATUS_COLORS[display].includes("text-red-700"));
});

test("a row with no display_status, or one the screen doesn't know, shows its status", () => {
  assert.equal(loanDisplayStatus({ status: "ongoing" }), "ongoing");
  assert.equal(loanDisplayStatus({ status: "ongoing", display_status: null }), "ongoing");
  assert.equal(loanDisplayStatus({ status: "released", display_status: "someday" }), "released");
});

test("display_status never changes a loan that is not past due", () => {
  assert.equal(loanDisplayStatus({ status: "completed", display_status: "completed" }), "completed");
});

// ── one label for every list of loans ──────────────────────────────────────

test("a list row reads the same label on the Loans list and a member's Loans tab", () => {
  assert.equal(
    loanRowStatusLabel({ status: "for_review", current_approver: "Manager" }),
    "For Approval - Manager",
  );
  assert.equal(
    loanRowStatusLabel({ status: "for_review", current_approver: "Manager", current_status_label: "Credit Check" }),
    "For Approval - Credit Check",
  );
  assert.equal(
    loanRowStatusLabel({ status: "approved", current_status_label: "Ready for Release" }),
    "Approved - Ready for Release",
  );
  assert.equal(loanRowStatusLabel({ status: "ongoing", display_status: "past_due" }), "Past Due");
  assert.equal(loanRowStatusLabel({ status: "ongoing" }), "Current");
});

test("a restructure's row says so, except once it has itself been restructured", () => {
  assert.equal(
    loanRowStatusLabel({ status: "ongoing", display_status: "past_due", is_restructure: true }),
    "Restructured — Past Due",
  );
  assert.equal(loanRowStatusLabel({ status: "restructured", is_restructure: true }), "Restructured");
});

test("the restructure page's loan picker reads the server's display_status, like the Loans list", () => {
  // A loan the API reports past due reads "Past Due" (red), not "Current".
  assert.equal(loanRowStatusLabel({ status: "ongoing", display_status: "past_due" }), "Past Due");
  assert.match(LOAN_STATUS_COLORS[loanDisplayStatus({ status: "ongoing", display_status: "past_due" })], /red/);
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/restructure/page.tsx"), "utf8");
  assert.ok(page.includes("LOAN_STATUS_COLORS[loanDisplayStatus(l)]"));
  assert.ok(page.includes("{loanRowStatusLabel(l)}"));
  assert.ok(!page.includes("LOAN_STATUS_LABELS[l.status]"));
});
