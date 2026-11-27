import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Loan } from "@/types";
import { loanMemberOptions, memberPicker } from "./member-picker";

describe("memberPicker", () => {
  test("a new application picks its member", () => {
    assert.deepEqual(memberPicker(false, null, null), { locked: false, label: null });
    assert.deepEqual(memberPicker(false, "Juan Dela Cruz", null), { locked: false, label: "Juan Dela Cruz" });
  });

  test("an edit locks the picker on the loan's member", () => {
    assert.deepEqual(memberPicker(true, "Juan Dela Cruz", "Juan Dela Cruz"), {
      locked: true,
      label: "Juan Dela Cruz",
    });
  });

  test("an edit still names the member when the member list doesn't have them", () => {
    assert.deepEqual(memberPicker(true, null, "Maria Santos"), { locked: true, label: "Maria Santos" });
  });

  test("an edit stays locked even with no name to show", () => {
    assert.equal(memberPicker(true, null, null).locked, true);
  });
});

describe("loanMemberOptions", () => {
  test("names the loan's member with their code", () => {
    const options = loanMemberOptions({
      id: 1,
      borrower: { id: 5, full_name: "Maria Santos", borrower_code: "M-5" },
    } as unknown as Loan);
    assert.deepEqual(options, [{ id: 5, full_name: "Maria Santos", borrower_code: "M-5" }]);
  });

  test("names co-makers who are members, even past the first page of any search", () => {
    const options = loanMemberOptions({
      id: 1,
      co_makers: [
        { id: 1, borrower_id: 4001, full_name: "Rosa Lim" },
        { id: 2, full_name: "No Member Record" },
      ],
    } as unknown as Loan);
    assert.deepEqual(options, [{ id: 4001, full_name: "Rosa Lim" }]);
  });

  test("a loan with neither names nobody", () => {
    assert.deepEqual(loanMemberOptions({ id: 1 } as unknown as Loan), []);
  });
});
