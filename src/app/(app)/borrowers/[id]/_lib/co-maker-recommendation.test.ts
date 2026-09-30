/**
 * The borrower page's "a co-maker is recommended" flag, shared by the Overview
 * count and the Loans tab.
 *
 * WHAT THIS PROVES: the flag reads the loan's own `co_makers`, with the
 * threshold and the completed-loan exception it always had.
 * WHAT IT DOES NOT PROVE: that `GET /loans` sends `co_makers` on each row; see
 * `src/services/loan-co-maker.test.ts` for what the borrower page's read
 * passes through.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Loan } from "@/types/loan";
import { CO_MAKER_RECOMMENDED_FROM, loanNeedsCoMaker } from "./co-maker-recommendation";

function loan(extra: Partial<Pick<Loan, "principal_amount" | "status" | "co_makers">>) {
  return {
    principal_amount: CO_MAKER_RECOMMENDED_FROM,
    status: "current" as const,
    co_makers: [],
    ...extra,
  };
}

describe("loanNeedsCoMaker", () => {
  test("a loan at the threshold with no co-maker is flagged", () => {
    assert.equal(loanNeedsCoMaker(loan({})), true);
  });

  test("a loan with a co-maker of its own is not", () => {
    assert.equal(loanNeedsCoMaker(loan({ co_makers: [{ id: 11, full_name: "Ben Santos" }] })), false);
  });

  test("a loan below the threshold is not", () => {
    assert.equal(loanNeedsCoMaker(loan({ principal_amount: CO_MAKER_RECOMMENDED_FROM - 1 })), false);
  });

  test("a completed loan is not", () => {
    assert.equal(loanNeedsCoMaker(loan({ status: "completed" })), false);
  });

  test("a row without co_makers counts as having none", () => {
    assert.equal(loanNeedsCoMaker(loan({ co_makers: undefined })), true);
  });
});
