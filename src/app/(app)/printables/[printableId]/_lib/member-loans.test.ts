import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { LOAN_PICKER_TABS, loanPickerCounts, loanPickerTab, memberLoanParams } from "./member-loans";

describe("one member's loans on the printable picker", () => {
  test("reads the summary rows, which hold every figure the table shows", () => {
    assert.deepEqual(memberLoanParams(12), { borrower_id: 12, view: "summary" });
  });
});

describe("the picker's tabs", () => {
  test("a loan still for approval, a draft and an approved loan are not released, never Closed", () => {
    for (const status of ["draft", "for_review", "approved"]) {
      assert.equal(loanPickerTab(status), "not_released", status);
    }
  });

  test("released loans are Active, under every spelling", () => {
    for (const status of ["released", "ongoing", "current", "past_due"]) {
      assert.equal(loanPickerTab(status), "active", status);
    }
  });

  test("finished and never-released loans are Closed", () => {
    for (const status of ["completed", "closed", "defaulted", "restructured", "rejected", "void"]) {
      assert.equal(loanPickerTab(status), "closed", status);
    }
  });

  test("the tabs read in words, in order, and every loan counts once under All", () => {
    assert.deepEqual(
      LOAN_PICKER_TABS.map((tab) => [tab.key, tab.label]),
      [
        ["active", "Active"],
        ["not_released", "Not yet released"],
        ["closed", "Closed"],
        ["all", "All"],
      ],
    );
    const counts = loanPickerCounts([
      { status: "for_review" },
      { status: "ongoing" },
      { status: "completed" },
      { status: "draft" },
    ]);
    assert.deepEqual(counts, { active: 1, not_released: 2, closed: 1, all: 4 });
  });
});
