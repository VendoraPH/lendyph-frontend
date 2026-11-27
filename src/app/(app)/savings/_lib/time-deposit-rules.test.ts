import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TD_STATUS_LABELS,
  canPreterminate,
  canSettle,
  daysBetween,
  maturityHint,
  pendingApprovalBlocker,
  pendingApprovalText,
  termsOfferedText,
  parseTermOptions,
  tdStatusTabs,
} from "./time-deposit-rules";

test("daysBetween counts calendar days and reads timestamps by their date", () => {
  assert.equal(daysBetween("2026-11-07", "2026-12-07"), 30);
  assert.equal(daysBetween("2026-11-07", "2026-11-05"), -2);
  assert.equal(daysBetween("2026-11-07T00:00:00Z", "2026-11-08"), 1);
});

test("settle on or after maturity; pre-terminate only before it", () => {
  const td = { status: "active" as const, maturity_date: "2026-11-10" };
  assert.equal(canSettle(td, "2026-11-09"), false);
  assert.equal(canPreterminate(td, "2026-11-09"), true);
  assert.equal(canSettle(td, "2026-11-10"), true);
  assert.equal(canPreterminate(td, "2026-11-10"), false);
  assert.equal(canSettle({ status: "matured", maturity_date: "2026-11-10" }, "2026-11-01"), true);
  assert.equal(canSettle({ status: "withdrawn", maturity_date: "2026-11-10" }, "2026-12-01"), false);
  assert.equal(canPreterminate({ status: "rolled_over", maturity_date: "2027-01-01" }, "2026-11-01"), false);
});

test("maturityHint counts down, then counts overdue days, then goes quiet", () => {
  const md = "2026-11-10";
  assert.equal(maturityHint({ status: "active", maturity_date: md }, "2026-11-09"), "Matures in 1 day");
  assert.equal(maturityHint({ status: "active", maturity_date: md }, "2026-11-10"), "Matures today");
  assert.equal(maturityHint({ status: "matured", maturity_date: md }, "2026-11-13"), "Due 3 days ago");
  assert.equal(maturityHint({ status: "withdrawn", maturity_date: md }, "2026-11-13"), null);
});

test("parseTermOptions sorts and de-duplicates, and refuses junk", () => {
  assert.deepEqual(parseTermOptions("180, 30,90 ,30"), [30, 90, 180]);
  assert.equal(parseTermOptions(""), null);
  assert.equal(parseTermOptions("30, 0"), null);
  assert.equal(parseTermOptions("30, 1.5"), null);
});

test("tdStatusTabs counts each status from meta.stats and adds no total in the browser", () => {
  const tabs = tdStatusTabs({ active: 3, matured: 1 });
  assert.deepEqual(tabs[0], { value: "all", label: "All", count: null });
  assert.deepEqual(
    tabs.slice(1).map((t) => [t.label, t.count]),
    [["Active", 3], ["Matured", 1], ["Withdrawn", 0], ["Rolled over", 0], ["Pre-terminated", 0]],
  );
  assert.equal(TD_STATUS_LABELS.preterminated, "Pre-terminated");
});

test("a time deposit with a request waiting says so in words and blocks settling", () => {
  const pending = { id: 3, kind: "td_payout" as const, amount: "50400.00", requested_by: { id: 1, name: "Ana" } };
  assert.equal(pendingApprovalText({ pending_approval: pending }), "Waiting for approval: Time deposit payout");
  assert.equal(
    pendingApprovalText({ pending_approval: { ...pending, kind: "pretermination" } }),
    "Waiting for approval: Time deposit pre-termination",
  );
  assert.ok(pendingApprovalBlocker({ pending_approval: pending }));
  // Optional until S5: missing and null both mean nothing waits.
  assert.equal(pendingApprovalText({}), null);
  assert.equal(pendingApprovalBlocker({ pending_approval: null }), null);
});

test("the terms hint lists the product's own terms, never a fixed list", () => {
  assert.equal(termsOfferedText([365, 30, 180, 90]), "Offered: 30, 90, 180 and 365 days");
  assert.equal(termsOfferedText([90]), "Offered: 90 days");
  assert.equal(termsOfferedText([]), null);
  assert.equal(termsOfferedText(null), null);
});
