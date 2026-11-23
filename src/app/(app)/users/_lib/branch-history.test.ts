import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatTime } from "@/lib/format";
import { BRANCH_LOCK_REASON, PERMISSION_LOCK_REASON } from "./manage-lock";
import { branchHistoryLock, branchHistoryRows } from "./branch-history";

describe("branchHistoryLock", () => {
  test("a caller who sees every branch reaches everyone, a super_admin's account included", () => {
    assert.deepEqual(
      branchHistoryLock({ can_manage: false }, { viewAll: true, isSelf: false, branchLocked: false }),
      { locked: false, reason: null },
    );
  });

  test("a caller always reaches their own history", () => {
    assert.deepEqual(
      branchHistoryLock({ can_manage: false }, { viewAll: false, isSelf: true, branchLocked: true }),
      { locked: false, reason: null },
    );
  });

  test("without every branch, a user who also works in another branch is out of reach", () => {
    assert.deepEqual(
      branchHistoryLock({ can_manage: true }, { viewAll: false, isSelf: false, branchLocked: true }),
      { locked: true, reason: BRANCH_LOCK_REASON },
    );
  });

  test("without every branch, the server's can_manage: false is out of reach too", () => {
    assert.deepEqual(
      branchHistoryLock({ can_manage: false }, { viewAll: false, isSelf: false, branchLocked: false }),
      { locked: true, reason: PERMISSION_LOCK_REASON },
    );
  });

  test("a row the server didn't judge is open while the client sees no lock", () => {
    assert.deepEqual(branchHistoryLock({}, { viewAll: false, isSelf: false, branchLocked: false }), {
      locked: false,
      reason: null,
    });
  });
});

describe("branchHistoryRows", () => {
  const at = "2026-11-24T01:30:00.000000Z";

  test("each entry reads the server's own words, with who and when in Manila time", () => {
    assert.deepEqual(
      branchHistoryRows([
        {
          id: 5,
          kind: "primary",
          from: "North",
          to: "Organisation-wide",
          description: "Primary branch changed from North to Organisation-wide.",
          by: "Ana Cruz",
          at,
        },
      ]),
      [
        {
          key: 5,
          change: "Primary branch",
          description: "Primary branch changed from North to Organisation-wide.",
          by: "Ana Cruz",
          date: formatDate(at),
          time: formatTime(at),
        },
      ],
    );
  });

  test("an assignment reads as a branches change, and a row nobody signed reads System", () => {
    const [row] = branchHistoryRows([
      {
        id: 6,
        kind: "branches",
        from: ["North"],
        to: ["North", "Another branch"],
        description: "Branches changed from North to North, Another branch.",
        by: "",
        at,
      },
    ]);
    assert.equal(row.change, "Branches");
    assert.equal(row.by, "System");
  });

  test("a kind this screen doesn't know never shows its key", () => {
    const [row] = branchHistoryRows([
      { id: 7, kind: "something_new", from: null, to: "North", description: "Set.", by: "Ana Cruz", at },
    ]);
    assert.equal(row.change, "Branch change");
  });

  test("a date the server didn't send shows a dash", () => {
    const [row] = branchHistoryRows([
      { id: 8, kind: "primary", from: null, to: "North", description: "Primary branch set to North.", by: "Ana Cruz", at: null },
    ]);
    assert.equal(row.date, "—");
    assert.equal(row.time, "");
  });
});
