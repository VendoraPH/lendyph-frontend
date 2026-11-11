import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { allocationPenaltyNote, penaltyMonthsNote } from "./penalty-months";

describe("penaltyMonthsNote", () => {
  test("the server's count, singular for one", () => {
    assert.equal(penaltyMonthsNote(150, 1), "Penalty: 1 month late");
    assert.equal(penaltyMonthsNote(450, 3), "Penalty: 3 months late");
    assert.equal(penaltyMonthsNote("75.50", "2"), "Penalty: 2 months late");
  });

  test("nothing without a penalty above ₱0.00 or at least one month", () => {
    assert.equal(penaltyMonthsNote(0, 2), null);
    assert.equal(penaltyMonthsNote("0.00", 2), null);
    assert.equal(penaltyMonthsNote(0.004, 2), null);
    assert.equal(penaltyMonthsNote(150, 0), null);
    assert.equal(penaltyMonthsNote(150, null), null);
    assert.equal(penaltyMonthsNote(150, undefined), null);
    assert.equal(penaltyMonthsNote(150, 1.5), null);
    assert.equal(penaltyMonthsNote(null, 2), null);
    assert.equal(penaltyMonthsNote("abc", 2), null);
  });
});

describe("allocationPenaltyNote", () => {
  const rows = [
    { id: 11, period_number: 1, penalty_amount: 0, penalty_months: 0 },
    { id: 12, period_number: 2, penalty_amount: 300, penalty_months: 2 },
    { id: 14, period_number: 4, penalty_amount: 150, penalty_months: 1 },
  ];

  test("the allocation's own schedule row, by id, else by the server's period number", () => {
    assert.equal(allocationPenaltyNote(rows, { schedule_id: 12, period: 9 }), "Penalty: 2 months late");
    assert.equal(allocationPenaltyNote(rows, { period: 4 }), "Penalty: 1 month late");
  });

  test("nothing for a period with no penalty or no row", () => {
    assert.equal(allocationPenaltyNote(rows, { schedule_id: 11 }), null);
    assert.equal(allocationPenaltyNote(rows, { schedule_id: 99 }), null);
    assert.equal(allocationPenaltyNote(rows, { period: 3 }), null);
    assert.equal(allocationPenaltyNote(rows, {}), null);
    assert.equal(allocationPenaltyNote([], { schedule_id: 12 }), null);
  });
});
