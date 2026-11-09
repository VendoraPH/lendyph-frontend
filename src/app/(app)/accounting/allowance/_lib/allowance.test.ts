process.env.TZ = "Asia/Manila";

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type {
  AllowanceBranch,
  AllowancePostingPage,
  AllowancePostingRow,
  AllowancePreview,
  AllowanceRun,
} from "@/types";
import {
  ALLOWANCE_PERMISSION,
  CONFLICT_MESSAGE,
  DASH,
  HISTORY_PER_PAGE,
  POST_PERMISSION_REASON,
  accessNotice,
  adjustmentText,
  branchViews,
  confirmLines,
  historyQuery,
  historyRows,
  historyTotal,
  lastPostingText,
  postFailure,
  postFromPreview,
  postState,
  rateStrip,
  totalsView,
  unassignedNotice,
} from "./allowance";

const RATES: AllowancePreview["rates"] = [
  { bucket: "1_30", label: "1–30 days", rate_percent: "5" },
  { bucket: "31_60", label: "31–60 days", rate_percent: "15" },
  { bucket: "61_90", label: "61–90 days", rate_percent: "25" },
  { bucket: "91_120", label: "91–120 days", rate_percent: "50" },
  { bucket: "over_120", label: "Over 120 days", rate_percent: "50" },
];

const zeroBuckets = (): AllowanceBranch["buckets"] =>
  RATES.map((rate) => ({
    bucket: rate.bucket,
    loan_count: 0,
    principal: 0,
    rate_percent: rate.rate_percent,
    required: 0,
  }));

/** Provides: required ₱1,250.00 against ₱500.00 held. */
const MAIN: AllowanceBranch = {
  branch: { id: 1, name: "Main Branch" },
  buckets: [
    { bucket: "1_30", loan_count: 2, principal: 1_000_000, rate_percent: "5", required: 50_000 },
    { bucket: "31_60", loan_count: 1, principal: 333_333, rate_percent: "15", required: 50_000 },
    { bucket: "61_90", loan_count: 0, principal: 0, rate_percent: "25", required: 0 },
    { bucket: "91_120", loan_count: 1, principal: 50_000, rate_percent: "50", required: 25_000 },
    { bucket: "over_120", loan_count: 0, principal: 0, rate_percent: "50", required: 0 },
  ],
  principal: 1_383_333,
  required: 125_000,
  current_balance: 50_000,
  adjustment: 75_000,
};

/** Releases: required ₱0.00 against ₱2,000.00 held. */
const NORTH: AllowanceBranch = {
  branch: { id: 2, name: "North Branch" },
  buckets: zeroBuckets(),
  principal: 0,
  required: 0,
  current_balance: 200_000,
  adjustment: -200_000,
};

/** No change: nothing required and nothing held. */
const SOUTH: AllowanceBranch = {
  branch: { id: 3, name: "South Branch" },
  buckets: zeroBuckets(),
  principal: 0,
  required: 0,
  current_balance: 0,
  adjustment: 0,
};

const preview = (overrides: Partial<AllowancePreview> = {}): AllowancePreview => ({
  as_of: "2026-11-09",
  rates: RATES,
  branches: [MAIN, NORTH, SOUTH],
  totals: {
    loan_count: 4,
    principal: 1_383_333,
    required: 125_000,
    current_balance: 250_000,
    adjustment: -125_000,
  },
  unassigned_balance: 0,
  last_posting: null,
  can_post: true,
  blocking_reasons: [],
  ...overrides,
});

describe("the preview shows the server's figures", () => {
  test("the rate strip reads each bucket in words, with its rate exactly as sent", () => {
    assert.deepEqual(
      rateStrip(preview()).map((rate) => rate.text),
      ["1–30 days 5%", "31–60 days 15%", "61–90 days 25%", "91–120 days 50%", "Over 120 days 50%"],
    );
    const odd = preview({ rates: [{ bucket: "1_30", label: "1–30 days", rate_percent: "2.375" }] });
    assert.equal(rateStrip(odd)[0].text, "1–30 days 2.375%");
  });

  test("a branch that provides lists its buckets and reads Provide", () => {
    const [main] = branchViews(preview());
    assert.equal(main.name, "Main Branch");
    assert.deepEqual(main.rows[1], {
      bucket: "31_60",
      label: "31–60 days",
      loans: "1",
      principal: "₱3,333.33",
      rate: "15%",
      required: "₱500.00",
    });
    assert.equal(main.principal, "₱13,833.33");
    assert.equal(main.required, "₱1,250.00");
    assert.equal(main.currentBalance, "₱500.00");
    assert.equal(main.adjustment, "Provide ₱750.00");
    assert.equal(main.direction, "provide");
  });

  test("a branch holding more than required reads Release, without a minus sign", () => {
    const north = branchViews(preview())[1];
    assert.equal(north.adjustment, "Release ₱2,000.00");
    assert.equal(north.direction, "release");
    assert.equal(north.rows[0].principal, "₱0.00");
  });

  test("a branch with nothing to move reads No change", () => {
    const south = branchViews(preview())[2];
    assert.equal(south.adjustment, "No change");
    assert.equal(south.direction, "none");
    assert.equal(south.required, "₱0.00");
  });

  test("the totals are the server's, never the branches added up", () => {
    // Deliberately unlike the branches' sum: the screen shows what was sent.
    const shown = totalsView(
      preview({
        totals: { loan_count: 9, principal: 1, required: 2, current_balance: 3, adjustment: 4 },
      }),
    );
    assert.deepEqual(shown, {
      loans: "9",
      principal: "₱0.01",
      required: "₱0.02",
      currentBalance: "₱0.03",
      adjustment: "Provide ₱0.04",
    });
  });

  test("a figure the server didn't send reads a dash", () => {
    const missing = { ...MAIN, required: undefined, current_balance: null } as unknown as AllowanceBranch;
    const [view] = branchViews(preview({ branches: [missing] }));
    assert.equal(view.required, DASH);
    assert.equal(view.currentBalance, DASH);
    assert.equal(adjustmentText(undefined), DASH);
    assert.equal(adjustmentText(Number.NaN), DASH);
  });

  test("the unassigned 1200 balance is named only when there is one", () => {
    assert.equal(unassignedNotice(0), null);
    assert.equal(unassignedNotice(null), null);
    assert.equal(
      unassignedNotice(123_456),
      "₱1,234.56 of the allowance is on journals with no branch. It isn't changed by this run; move it with a journal entry if it belongs to a branch.",
    );
  });

  test("the last posting reads its date and who posted it", () => {
    assert.equal(lastPostingText(null), "Not posted yet.");
    assert.equal(
      lastPostingText({
        as_of: "2026-10-31",
        posted_at: "2026-11-01T02:00:00Z",
        posted_by: { id: 4, name: "Ana Reyes" },
      }),
      "Last posted as of Oct 31, 2026 by Ana Reyes",
    );
    assert.equal(
      lastPostingText({ as_of: "2026-10-31", posted_at: "2026-11-01T02:00:00Z", posted_by: null }),
      "Last posted as of Oct 31, 2026",
    );
  });

  test("the screen needs access to every branch", () => {
    assert.equal(accessNotice(true), null);
    assert.match(accessNotice(false)!, /every branch/);
  });
});

describe("the Post button", () => {
  test("is gated on accounting:allowance", () => {
    assert.equal(ALLOWANCE_PERMISSION, "accounting:allowance");
  });

  test("is enabled only with accounting:allowance and the server's can_post", () => {
    assert.deepEqual(postState(preview(), true), { enabled: true, reason: null, reasons: [] });
  });

  test("is disabled without accounting:allowance, and says why", () => {
    const state = postState(preview(), false);
    assert.equal(state.enabled, false);
    assert.equal(state.reason, POST_PERMISSION_REASON);
    assert.equal(POST_PERMISSION_REASON, "You need permission to post the allowance");
  });

  test("is disabled when the server says it can't post, with the server's reasons", () => {
    const blocked = preview({
      can_post: false,
      blocking_reasons: ["November 2026 is closed."],
    });
    assert.deepEqual(postState(blocked, true), {
      enabled: false,
      reason: null,
      reasons: ["November 2026 is closed."],
    });
  });

  test("without permission, the permission reason wins over the server's", () => {
    const blocked = preview({ can_post: false, blocking_reasons: ["Nothing changes."] });
    assert.equal(postState(blocked, false).reason, POST_PERMISSION_REASON);
    assert.equal(postState(blocked, false).enabled, false);
  });
});

describe("posting", () => {
  test("the confirm lists each branch's adjustment and the server's total", () => {
    assert.deepEqual(confirmLines(preview()), {
      branches: [
        { id: 1, name: "Main Branch", text: "Provide ₱750.00" },
        { id: 2, name: "North Branch", text: "Release ₱2,000.00" },
        { id: 3, name: "South Branch", text: "No change" },
      ],
      total: "Release ₱1,250.00",
    });
  });

  test("sends the preview's date and totals.adjustment as expected_adjustment", async () => {
    const calls: Array<[string, number]> = [];
    const run: AllowanceRun = {
      run_id: "6b1f",
      as_of: "2026-11-09",
      postings: [],
      totals: { required: 0, previous_balance: 0, adjustment: -125_000 },
    };
    const answer = await postFromPreview(preview(), (asOf, expected) => {
      calls.push([asOf, expected]);
      return Promise.resolve(run);
    });
    assert.deepEqual(calls, [["2026-11-09", -125_000]]);
    assert.equal(answer, run);
  });

  test("a 409 is a conflict that reloads the preview", () => {
    const err = { response: { status: 409, data: { message: "The figures changed since the preview; review them again" } } };
    assert.deepEqual(postFailure(err), { kind: "conflict" });
    assert.match(CONFLICT_MESSAGE, /figures changed since the preview/);
  });

  test("a 409 from a collision is a conflict too", () => {
    const err = {
      response: {
        status: 409,
        data: { message: "Another change to the allowance was saved at the same time. Review the preview and try again." },
      },
    };
    assert.deepEqual(postFailure(err), { kind: "conflict" });
  });

  test("a 422 shows the server's words", () => {
    const nothing = "Nothing to post: every branch's allowance already equals what is required.";
    const err = { response: { status: 422, data: { message: nothing, errors: { allowance: [nothing] } } } };
    assert.deepEqual(postFailure(err), { kind: "error", message: nothing });

    const future = "The allowance can't be posted for a date in the future.";
    const dated = { response: { status: 422, data: { message: future, errors: { as_of: [future] } } } };
    assert.deepEqual(postFailure(dated), { kind: "error", message: future });
  });
});

describe("the postings history", () => {
  const row = (overrides: Partial<AllowancePostingRow> = {}): AllowancePostingRow => ({
    id: 11,
    run_id: "6b1f",
    as_of: "2026-10-31",
    branch: { id: 1, name: "Main Branch" },
    required: 125_000,
    previous_balance: 50_000,
    adjustment: 75_000,
    journal: { id: 88, journal_no: "JE-2026-000088" },
    created_by: { id: 4, name: "Ana Reyes" },
    created_at: "2026-11-01T02:00:00Z",
    ...overrides,
  });

  const page = (rows: AllowancePostingRow[], adjustment: number): AllowancePostingPage => ({
    data: rows,
    meta: { current_page: 1, last_page: 1, per_page: 25, total: rows.length, totals: { adjustment } },
  });

  test("asks the server for 25 rows a page", () => {
    assert.equal(HISTORY_PER_PAGE, 25);
    assert.deepEqual(historyQuery(2, HISTORY_PER_PAGE), { page: 2, per_page: 25 });
  });

  test("each row reads the server's figures and links its journal", () => {
    const [view] = historyRows(page([row()], 75_000));
    assert.equal(view.asOf, "Oct 31, 2026");
    assert.equal(view.branch, "Main Branch");
    assert.equal(view.required, "₱1,250.00");
    assert.equal(view.previousBalance, "₱500.00");
    assert.equal(view.adjustment, "Provide ₱750.00");
    assert.deepEqual(view.journal, { label: "JE-2026-000088", href: "/accounting/journals/88" });
    assert.equal(view.postedBy, "Ana Reyes");
    assert.match(view.postedAt, /Nov 1, 2026/);
  });

  test("a posting with no journal or no user reads a dash", () => {
    const [view] = historyRows(page([row({ journal: null, created_by: null, adjustment: 0 })], 0));
    assert.equal(view.journal, null);
    assert.equal(view.postedBy, DASH);
    assert.equal(view.adjustment, "No change");
  });

  test("the footer is meta.totals.adjustment over every row, not the page added up", () => {
    assert.equal(historyTotal(page([row(), row({ id: 12, adjustment: -200_000 })], 5_000)), "Provide ₱50.00");
    const noTotals = { ...page([row()], 0), meta: { ...page([row()], 0).meta, totals: undefined } };
    assert.equal(historyTotal(noTotals as unknown as AllowancePostingPage), DASH);
  });
});
