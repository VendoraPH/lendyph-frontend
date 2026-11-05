import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { memberLoanParams } from "./member-loans";

describe("one member's loans on the printable picker", () => {
  test("reads the summary rows, which hold every figure the table shows", () => {
    assert.deepEqual(memberLoanParams(12), { borrower_id: 12, view: "summary" });
  });
});
