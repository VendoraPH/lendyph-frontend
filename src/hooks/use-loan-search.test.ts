import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Loan } from "@/types";
import {
  LOAN_PAGE_SIZE,
  fetchLoanPage,
  loanEmptyMessage,
  loanSearchParams,
  loanSearchStatus,
  toLoanOption,
} from "./use-loan-search";
import type { SearchView } from "./use-search-page";

const loan = (fields: Partial<Loan>) => ({ id: 7, ...fields }) as Loan;

const view = (fields: Partial<SearchView>): SearchView => ({
  query: "",
  shown: 0,
  total: 0,
  pending: false,
  failed: false,
  ...fields,
});

describe("what is asked of the server", () => {
  test("the first 25 loans ever released before typing, closed ones too, without schedules", () => {
    assert.equal(LOAN_PAGE_SIZE, 25);
    assert.deepEqual(loanSearchParams(""), {
      status: "released,ongoing,completed,defaulted,restructured",
      view: "summary",
      per_page: 25,
    });
  });

  test("the search goes to the server", () => {
    assert.deepEqual(loanSearchParams("LN-001"), {
      status: "released,ongoing,completed,defaulted,restructured",
      view: "summary",
      per_page: 25,
      search: "LN-001",
    });
  });

  // The picker used to drain every active loan, and stopped at 2,000.
  test("a search is one request, however many pages match", async () => {
    const asked: Record<string, unknown>[] = [];
    const answer = await fetchLoanPage(async (params) => {
      asked.push(params);
      return {
        data: [loan({ loan_account_number: "LN-001" })],
        meta: { total: 5000 },
      };
    }, "LN");
    assert.equal(asked.length, 1);
    assert.equal(asked[0].search, "LN");
    assert.equal(answer.total, 5000);
    assert.equal(answer.query, "LN");
    assert.equal(answer.rows[0].label, "LN-001");
  });

  test("an answer with no meta counts its own rows", async () => {
    const answer = await fetchLoanPage(async () => ({ data: [loan({})] }), "");
    assert.equal(answer.total, 1);
  });
});

describe("one loan as the picker shows it", () => {
  test("the account number, with the member under it", () => {
    assert.deepEqual(
      toLoanOption(
        loan({
          loan_account_number: "LN-001",
          application_number: "APP-1",
          borrower: { full_name: "Maria Santos" } as Loan["borrower"],
        }),
      ),
      { id: 7, label: "LN-001", hint: "Maria Santos" },
    );
  });

  test("falls back to the application number, then the id", () => {
    assert.equal(toLoanOption(loan({ application_number: "APP-1" })).label, "APP-1");
    assert.equal(toLoanOption(loan({})).label, "Loan #7");
  });
});

describe("what the picker says", () => {
  test("loading, searching and failing name loans", () => {
    assert.equal(loanSearchStatus(view({ pending: true })), "Loading loans…");
    assert.equal(loanSearchStatus(view({ pending: true, shown: 2 })), "Searching…");
    assert.equal(
      loanSearchStatus(view({ failed: true })),
      "Couldn't load loans. Keep typing to try again.",
    );
  });

  test("says when there are more than it shows", () => {
    assert.equal(
      loanSearchStatus(view({ shown: 25, total: 5000 })),
      "Showing 25 of 5000. Type a name or loan number to narrow.",
    );
    assert.equal(
      loanSearchStatus(view({ query: "san", shown: 25, total: 40 })),
      "Showing 25 of 40. Keep typing to narrow.",
    );
    assert.equal(loanSearchStatus(view({ shown: 3, total: 3 })), "");
  });

  test("only a settled search says nobody matched", () => {
    assert.equal(loanEmptyMessage(view({ pending: true })), null);
    assert.equal(loanEmptyMessage(view({ failed: true })), null);
    assert.equal(loanEmptyMessage(view({})), "No loan found.");
    assert.equal(loanEmptyMessage(view({ query: "zz" })), "No loan matches “zz”.");
  });
});
