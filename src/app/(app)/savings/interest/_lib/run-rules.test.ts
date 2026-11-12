import { test } from "node:test";
import assert from "node:assert/strict";
import type { InterestRun, SavingsProduct } from "@/types";
import {
  buildRunRequest,
  createdMessage,
  isIsoDate,
  MAKER_APPROVE_REASON,
  RUN_STATUS_TABS,
  MAKER_REJECT_REASON,
  runActions,
  runLineTierLines,
  runProductOptions,
  skipReasonText,
} from "./run-rules";

const maker = { id: 5, name: "Ana" };

test("a draft offers approve and reject; the maker can't approve or reject their own run", () => {
  assert.deepEqual(runActions({ status: "draft", created_by: maker }, 9), {
    approve: true,
    approveBlocked: null,
    reject: true,
    rejectBlocked: null,
    post: false,
    reverse: false,
  });
  const own = runActions({ status: "draft", created_by: maker }, 5);
  assert.equal(own.approve, true);
  assert.equal(own.approveBlocked, MAKER_APPROVE_REASON);
  assert.equal(own.rejectBlocked, MAKER_REJECT_REASON);
  assert.equal(MAKER_APPROVE_REASON, "You created this run; another user must approve it");
});

test("an approved run offers only post; a posted one only reverse", () => {
  const approved = runActions({ status: "approved", created_by: maker }, 5);
  assert.deepEqual([approved.approve, approved.reject, approved.post, approved.reverse], [false, false, true, false]);
  const posted = runActions({ status: "posted", created_by: maker }, 9);
  assert.deepEqual([posted.approve, posted.reject, posted.post, posted.reverse], [false, false, false, true]);
});

test("rejected and reversed runs offer nothing", () => {
  for (const status of ["rejected", "reversed"] as const) {
    const actions = runActions({ status, created_by: null }, 9);
    assert.deepEqual([actions.approve, actions.reject, actions.post, actions.reverse], [false, false, false, false]);
  }
});

test("a run the system created is never the viewer's own", () => {
  assert.equal(runActions({ status: "draft", created_by: null }, 5).approveBlocked, null);
  assert.equal(runActions({ status: "draft", created_by: maker }, null).approveBlocked, null);
});

test("the request carries the product, the period start and one branch when picked", () => {
  assert.deepEqual(buildRunRequest({ productId: "3", periodStart: "2026-10-01", branch: "all" }, undefined), {
    ok: true,
    request: { product_id: 3, period_start: "2026-10-01" },
  });
  assert.deepEqual(buildRunRequest({ productId: "3", periodStart: "2026-10-01", branch: "2" }, 2), {
    ok: true,
    request: { product_id: 3, period_start: "2026-10-01", branch_ids: [2] },
  });
});

test("a missing product or a bad date is refused in words", () => {
  assert.deepEqual(buildRunRequest({ productId: "", periodStart: "2026-10-01", branch: "all" }, undefined), {
    ok: false,
    message: "Pick a savings product.",
  });
  for (const periodStart of ["", "2026-13-01", "2026-02-30", "01/10/2026"]) {
    const check = buildRunRequest({ productId: "1", periodStart, branch: "all" }, undefined);
    assert.equal(check.ok, false, periodStart);
  }
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(isIsoDate("2026-02-29"), false);
});

test("only regular products are offered", () => {
  const products = [
    { id: 1, code: "RS", name: "Regular Savings", kind: "regular" },
    { id: 2, code: "TD", name: "Time Deposit", kind: "time_deposit" },
  ] as SavingsProduct[];
  assert.deepEqual(runProductOptions(products), [{ value: "1", label: "Regular Savings (RS)" }]);
});

test("skip reasons read in words, never as the key", () => {
  assert.equal(skipReasonText({ skip_reason: null }), null);
  assert.equal(
    skipReasonText({ skip_reason: "below_minimum_adb" }),
    "Average daily balance below the product's minimum",
  );
  assert.equal(
    skipReasonText({ skip_reason: "below_earning_tier" }),
    "Below the first tier that earns interest",
  );
  assert.equal(skipReasonText({ skip_reason: "some_new_key" }), "Not credited");
});

test("status tabs read in words", () => {
  assert.deepEqual(
    RUN_STATUS_TABS.map((t) => t.label),
    ["All", "Draft", "Approved", "Posted", "Rejected", "Reversed"],
  );
});

test("creating names how many drafts were made", () => {
  assert.equal(createdMessage([{ id: 1 } as InterestRun]), "Draft run created");
  assert.equal(createdMessage([{ id: 1 }, { id: 2 }] as InterestRun[]), "2 draft runs created, one per branch");
});

const LADDER = [
  { min_balance: null, rate: "0.5000" },
  { min_balance: "10000.00", rate: "2.0000" },
];

test("a tiered line lists each tier it used, in words, with the server's days", () => {
  assert.deepEqual(
    runLineTierLines({
      rate_segments: [
        {
          from: "2026-10-01",
          to: "2026-12-31",
          rate: "2.0000",
          tiers: LADDER,
          by_tier: [
            { min_balance: null, rate: "0.5000", days: 61, balance_days: 30500000 },
            { min_balance: "10000.00", rate: "2.0000", days: 31, balance_days: 37200000 },
          ],
        },
      ],
    }),
    ["Below ₱10,000.00: 0.5% a year, 61 days", "₱10,000.00 and up: 2% a year, 31 days"],
  );
});

test("a single-rate line, or one from before tiers, adds nothing to the Rate column", () => {
  assert.deepEqual(runLineTierLines({ rate_segments: [{ from: "2026-10-01", to: "2026-12-31", rate: "1.0000" }] }), []);
  assert.deepEqual(runLineTierLines({}), []);
});

test("when the ladder changed in the period, each segment's tiers carry its dates; one day reads '1 day'", () => {
  assert.deepEqual(
    runLineTierLines({
      rate_segments: [
        {
          from: "2026-10-01",
          to: "2026-10-31",
          rate: "0.5000",
          tiers: LADDER,
          by_tier: [{ min_balance: null, rate: "0.5000", days: 31, balance_days: 1 }],
        },
        {
          from: "2026-11-01",
          to: "2026-11-01",
          rate: "3.0000",
          tiers: [{ min_balance: null, rate: "1.0000" }, { min_balance: "10000.00", rate: "3.0000" }],
          by_tier: [{ min_balance: "10000.00", rate: "3.0000", days: 1, balance_days: 1 }],
        },
      ],
    }),
    [
      "Oct 1, 2026 to Oct 31, 2026: Below ₱10,000.00: 0.5% a year, 31 days",
      "Nov 1, 2026 to Nov 1, 2026: ₱10,000.00 and up: 3% a year, 1 day",
    ],
  );
});

