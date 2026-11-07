import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeDefaultDeadline,
  daysUntil,
  deadlineState,
  defaultReportingYear,
  describeDaysLeft,
  effectiveDeadline,
  fiscalYearEnd,
  reminderMilestone,
} from "./deadline";
import { availableActions, canTakeAction, isFiled, isLocked } from "./workflow";
import { countBySeverity, overallReadiness, readinessTone, sortIssues } from "./readiness";
import type { CdaReportSummary, CdaValidationIssue } from "@/types/cda";

describe("deadline", () => {
  test("120 days after Dec 31 is Apr 30 (non-leap) and Apr 29 (leap)", () => {
    assert.equal(computeDefaultDeadline("2025-12-31"), "2026-04-30");
    assert.equal(computeDefaultDeadline("2027-12-31"), "2028-04-29");
  });

  test("the day count is configurable, never hard-coded", () => {
    assert.equal(computeDefaultDeadline("2025-12-31", 90), "2026-03-31");
  });

  test("fiscal year-end is the month's last day", () => {
    assert.equal(fiscalYearEnd(2025), "2025-12-31");
    assert.equal(fiscalYearEnd(2024, 6), "2024-06-30");
    assert.equal(fiscalYearEnd(2024, 2), "2024-02-29");
  });

  test("an extension replaces the default", () => {
    assert.equal(effectiveDeadline({ default_deadline: "2026-04-30", extended_deadline: null }), "2026-04-30");
    assert.equal(
      effectiveDeadline({ default_deadline: "2026-04-30", extended_deadline: "2026-05-31" }),
      "2026-05-31",
    );
  });

  test("days until crosses months and goes negative after", () => {
    assert.equal(daysUntil("2026-04-30", "2026-03-31"), 30);
    assert.equal(daysUntil("2026-04-30", "2026-04-30"), 0);
    assert.equal(daysUntil("2026-04-30", "2026-05-02"), -2);
  });

  test("state: filed wins, then overdue / today / soon / upcoming", () => {
    assert.equal(deadlineState(-5, true), "done");
    assert.equal(deadlineState(-1, false), "overdue");
    assert.equal(deadlineState(0, false), "due_today");
    assert.equal(deadlineState(7, false), "due_soon");
    assert.equal(deadlineState(8, false), "upcoming");
  });

  test("reminders fire at 30/15/7/3, on the day and after", () => {
    assert.equal(reminderMilestone(30), 30);
    assert.equal(reminderMilestone(3), 3);
    assert.equal(reminderMilestone(4), null);
    assert.equal(reminderMilestone(0), "due");
    assert.equal(reminderMilestone(-1), "overdue");
  });

  test("reports cover the previous year", () => {
    assert.equal(defaultReportingYear("2026-11-07"), 2025);
  });

  test("describes days left", () => {
    assert.equal(describeDaysLeft(1), "1 day left");
    assert.equal(describeDaysLeft(0), "Due today");
    assert.equal(describeDaysLeft(-3), "3 days overdue");
  });
});

describe("workflow", () => {
  test("a critical issue blocks review and finalize, not validation", () => {
    assert.equal(canTakeAction("submit_for_review", "draft", 1), false);
    assert.equal(canTakeAction("submit_for_review", "draft", 0), true);
    assert.equal(canTakeAction("validate", "draft", 3), true);
    assert.equal(canTakeAction("finalize", "approved", 1), false);
  });

  test("actions follow the status", () => {
    assert.deepEqual(availableActions("for_review"), ["return", "approve"]);
    assert.equal(canTakeAction("approve", "draft", 0), false);
    assert.deepEqual(availableActions("accepted"), []);
  });

  test("finalized and later are locked; submitted and accepted are filed", () => {
    assert.equal(isLocked("approved"), false);
    assert.equal(isLocked("finalized"), true);
    assert.equal(isFiled("finalized"), false);
    assert.equal(isFiled("submitted"), true);
  });
});

describe("readiness", () => {
  const issue = (id: string, severity: CdaValidationIssue["severity"]): CdaValidationIssue => ({
    id,
    severity,
    message: id,
    report_type: "capr",
  });

  test("counts and sorts by severity", () => {
    const issues = [issue("a", "info"), issue("b", "critical"), issue("c", "warning"), issue("d", "critical")];
    assert.deepEqual(countBySeverity(issues), { critical: 2, warning: 1, info: 1 });
    assert.deepEqual(sortIssues(issues).map((i) => i.id), ["b", "d", "c", "a"]);
  });

  test("overall readiness ignores reports that do not apply", () => {
    const summary = (readiness: number, applicable = true) =>
      ({ readiness, applicable }) as CdaReportSummary;
    assert.equal(overallReadiness([summary(100), summary(50), summary(0, false)]), 75);
    assert.equal(overallReadiness([]), 0);
    assert.equal(overallReadiness([summary(150)]), 100);
  });

  test("tone: a critical issue blocks even at 100", () => {
    assert.equal(readinessTone(100, 1), "blocked");
    assert.equal(readinessTone(100, 0), "ready");
    assert.equal(readinessTone(80, 0), "progress");
  });
});
