import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsDashboardKpis } from "@/types/savings-insight";
import {
  SERIES_LABELS,
  SERIES_NOTE,
  bucketPoints,
  compactPesoAxis,
  glNotice,
  kpiCards,
  seriesPoints,
  signOf,
} from "./dashboard-view";
import { periodError, presetPeriod } from "./dashboard-period";

const KPIS: SavingsDashboardKpis = {
  total_deposits: "125000.50",
  savings_balance: "75000.50",
  time_deposits: { count: 2, amount: "50000.00" },
  accounts: { active: 12, dormant: 3, frozen: 1, as_of: "2026-11-12" },
  new_accounts: 1,
  deposits: { count: 1, amount: "5000.00" },
  withdrawals: { count: 4, amount: "7000.25" },
  net_deposit_movement: "-2000.25",
  interest_credited: { gross: "120.00", tax: "0.00", net: "120.00" },
  fees_charged: { count: 1, amount: "15.00" },
  share_capital_transfers: { count: 2, amount: "1700.00" },
  time_deposit_interest_paid: { gross: "300.00", tax: "0.00" },
  maturing_30_days: { count: 1, principal: "20000.00", maturity_amount: "20150.75" },
  gl_control: {
    as_of: "2026-11-12",
    is_balanced: true,
    differences: 0,
    subledger_balance: "125000.50",
    gl_balance: "125000.50",
    difference: "0.00",
    warning: null,
    product_filter_ignored: false,
  },
};

const card = (key: string) => {
  const found = kpiCards(KPIS).find((c) => c.key === key);
  assert.ok(found, key);
  return found;
};

test("each card shows the server's figure with ₱ and two decimals, counts in words", () => {
  assert.equal(card("total_deposits").value, "₱125,000.50");
  assert.equal(card("time_deposits").caption, "2 placements");
  assert.equal(card("deposits").caption, "1 deposit");
  assert.equal(card("withdrawals").value, "₱7,000.25");
  assert.equal(card("maturing_30_days").value, "₱20,150.75");
  assert.match(card("maturing_30_days").caption ?? "", /₱20,000.00 principal/);
  assert.equal(card("fees_charged").value, "₱15.00");
  assert.equal(card("dormant_accounts").value, "3");
  assert.match(card("active_accounts").caption ?? "", /As of Nov 12, 2026/);
});

test("the period card says it is deposits less withdrawals, and transfers to share capital have their own card", () => {
  const net = card("net_deposit_movement");
  assert.equal(net.label, "Deposits less Withdrawals");
  assert.match(net.caption ?? "", /fees, transfers to share capital and interest are not in it/i);
  assert.equal(card("share_capital_transfers").label, "Transfers to Share Capital");
  assert.equal(card("share_capital_transfers").value, "₱1,700.00");
  assert.equal(card("share_capital_transfers").caption, "2 transfers");
  assert.equal(kpiCards(KPIS).some((c) => /net/i.test(c.label)), false, "no card is called a net movement");
});

test("the monthly figure is named for what it holds: the change in total deposits", () => {
  assert.equal(SERIES_LABELS.net_movement, "Change in total deposits");
  assert.match(SERIES_NOTE, /after interest, fees and transfers/);
});

test("the net movement takes its colour from the server's sign, and a zero stays neutral", () => {
  assert.equal(card("net_deposit_movement").signed, "negative");
  assert.equal(card("net_deposit_movement").value, "-₱2,000.25");
  assert.equal(signOf("0.00"), null);
  assert.equal(signOf("10.00"), "positive");
  assert.equal(signOf(null), null);
});

test("no cards before the dashboard loads", () => {
  assert.deepEqual(kpiCards(null), []);
});

test("the GL check reads the server's warning and difference, and says when the product is ignored", () => {
  assert.deepEqual(glNotice(KPIS), {
    tone: "ok",
    message: "Savings records agree with the books as of Nov 12, 2026.",
    productNote: null,
  });
  const differs = glNotice({
    ...KPIS,
    gl_control: {
      ...KPIS.gl_control,
      is_balanced: false,
      differences: 1,
      difference: "123.45",
      warning: "Deposit Subsidiary Ledger does not reconcile with General Ledger.",
      product_filter_ignored: true,
    },
  });
  assert.ok(differs);
  assert.equal(differs.tone, "warning");
  assert.equal(
    differs.message,
    "Deposit Subsidiary Ledger does not reconcile with General Ledger. Difference ₱123.45 as of Nov 12, 2026.",
  );
  assert.match(differs.productNote ?? "", /every product/);
});

test("the series plots the server's strings and keeps them, formatted, for the tooltip", () => {
  const [point] = seriesPoints([
    {
      month: "2026-11",
      label: "Nov 2026",
      as_of: "2026-11-12",
      savings_balance: "75000.50",
      time_deposits: "50000.00",
      total_deposits: "125000.50",
      deposit_count: 1,
      deposits: "5000.00",
      withdrawal_count: 4,
      withdrawals: "7000.25",
      interest_credited: "120.00",
      net_movement: "-2000.25",
    },
  ]);
  assert.equal(point.tick, "Nov");
  assert.equal(point.savings_balance, 75000.5);
  assert.equal(point.text.total_deposits, "₱125,000.50");
  assert.equal(point.text.net_movement, "-₱2,000.25");
  assert.deepEqual(seriesPoints(undefined), []);
});

test("maturity buckets keep the server's labels and figures", () => {
  const [bucket] = bucketPoints([
    { key: "0_30", label: "0–30 days", from_days: null, to_days: 30, count: 1, principal: "20000.00", maturity_amount: "20150.75" },
  ]);
  assert.equal(bucket.label, "0–30 days");
  assert.equal(bucket.due, "₱20,150.75");
  assert.equal(bucket.maturity_amount, 20150.75);
});

test("only the axis abbreviates", () => {
  assert.equal(compactPesoAxis(130000), "₱130K");
  assert.equal(compactPesoAxis(-1500000), "-₱1.5M");
});

test("the period presets end today and a week starts on Monday", () => {
  const thursday = new Date(2026, 10, 12);
  assert.deepEqual(presetPeriod("today", thursday), { from: "2026-11-12", to: "2026-11-12" });
  assert.deepEqual(presetPeriod("this_week", thursday), { from: "2026-11-09", to: "2026-11-12" });
  assert.deepEqual(presetPeriod("this_week", new Date(2026, 10, 15)), { from: "2026-11-09", to: "2026-11-15" });
  assert.deepEqual(presetPeriod("this_month", thursday), { from: "2026-11-01", to: "2026-11-12" });
  assert.deepEqual(presetPeriod("this_year", thursday), { from: "2026-01-01", to: "2026-11-12" });
});

test("a custom period is checked as the server checks it", () => {
  assert.equal(periodError({ from: "2026-11-01", to: "2026-11-12" }, "2026-11-12"), null);
  assert.equal(periodError({ from: "2026-11-01", to: "2026-11-13" }, "2026-11-12"), "The end date can't be after today.");
  assert.equal(periodError({ from: "2026-11-10", to: "2026-11-02" }, "2026-11-12"), "The start date can't be after the end date.");
  assert.equal(periodError({ from: "", to: "2026-11-02" }, "2026-11-12"), "Pick both a start and an end date.");
});
