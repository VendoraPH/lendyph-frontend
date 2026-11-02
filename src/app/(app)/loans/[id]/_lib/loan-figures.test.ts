/**
 * The loan page's money figures, pinned against the server's fields.
 *
 * The page used to work several of these out in the browser: the Record
 * Payment presets added up each open period's total payment (leaving out the
 * premium and penalty owed, and counting a part-paid period in full), the
 * "Outstanding" tiles fell back from the summary's everything-owed figure to
 * the loan's principal-plus-premium one, and Total Payable fell back to the
 * schedule's total payment (one Share Capital Build-Up per period inside it).
 *
 * WHAT THIS PROVES: each figure shown is the one field the server sent for
 * it, a figure it did not send is null (a dash on screen) while 0 stays 0,
 * the presets offered are only the ones it sent, and "Outstanding" never
 * swaps meaning when the summary is missing.
 * WHAT IT DOES NOT PROVE: the figures; those are the backend's tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advancePresetAmount,
  offeredAdvancePresets,
  outstandingPrincipal,
  presetButtons,
  previewOutstandingAfter,
  previewOutstandingBefore,
  readAdvancePresets,
  readPayoffAmount,
  totalOutstanding,
  totalPayableFigures,
} from "./loan-figures";

test("readAdvancePresets keeps the server's presets, amounts as numbers", () => {
  assert.deepEqual(
    readAdvancePresets({
      advance_presets: [
        { periods: 1, amount: 12200 },
        { periods: 2, amount: "24000.50" },
      ],
    }),
    [
      { periods: 1, amount: 12200 },
      { periods: 2, amount: 24000.5 },
    ],
  );
});

test("readAdvancePresets is empty when the summary sent none or is missing", () => {
  assert.deepEqual(readAdvancePresets({}), []);
  assert.deepEqual(readAdvancePresets(null), []);
  assert.deepEqual(readAdvancePresets({ advance_presets: "x" }), []);
});

test("readAdvancePresets drops an entry with no readable amount or period count", () => {
  assert.deepEqual(
    readAdvancePresets({
      advance_presets: [
        { periods: 1, amount: 100 },
        { periods: 2 },
        { periods: "3", amount: 300 },
        { periods: 4, amount: "abc" },
      ],
    }),
    [{ periods: 1, amount: 100 }],
  );
});

test("advancePresetAmount reads advance_presets[n-1], never a sum of periods", () => {
  const presets = [
    { periods: 1, amount: 12200 },
    { periods: 2, amount: 24000 },
    { periods: 3, amount: 35800 },
  ];
  assert.equal(advancePresetAmount(presets, 1), 12200);
  assert.equal(advancePresetAmount(presets, 3), 35800);
});

test("advancePresetAmount is null for a preset the server did not send", () => {
  const presets = [{ periods: 1, amount: 12200 }];
  assert.equal(advancePresetAmount(presets, 2), null);
  assert.equal(advancePresetAmount([], 1), null);
  // An entry at n-1 that is for another period count is not that preset.
  assert.equal(advancePresetAmount([{ periods: 2, amount: 5 }], 1), null);
});

test("offeredAdvancePresets offers only the presets the server sent", () => {
  const sixOpen = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ periods: n, amount: n * 100 }));
  assert.deepEqual(
    offeredAdvancePresets(sixOpen, [1, 2, 3, 6]).map((p) => p.periods),
    [1, 2, 3, 6],
  );
  // A Share Capital Build-Up loan: the server sends only the 1-period entry.
  assert.deepEqual(
    offeredAdvancePresets([{ periods: 1, amount: 11900 }], [1, 2, 3, 6]),
    [{ periods: 1, amount: 11900 }],
  );
  assert.deepEqual(offeredAdvancePresets([], [1, 2, 3, 6]), []);
});

test("readPayoffAmount reads payoff_amount, null when not sent, 0 kept", () => {
  assert.equal(readPayoffAmount({ payoff_amount: "70800.00" }), 70800);
  assert.equal(readPayoffAmount({ payoff_amount: 0 }), 0);
  assert.equal(readPayoffAmount({ outstanding_balance: 70800 }), null);
  assert.equal(readPayoffAmount(null), null);
});

test("totalOutstanding reads the summary's total_outstanding first", () => {
  assert.equal(
    totalOutstanding({ total_outstanding: 70800, outstanding_balance: 1 }, { total_outstanding: 2 }),
    70800,
  );
});

test("totalOutstanding falls back to the loan's total_outstanding, same meaning", () => {
  assert.equal(totalOutstanding(null, { total_outstanding: "70800.00", outstanding_balance: 60400 }), 70800);
  assert.equal(totalOutstanding({}, { total_outstanding: 0 }), 0);
});

test("totalOutstanding never reads outstanding_balance from either source", () => {
  assert.equal(totalOutstanding({ outstanding_balance: 70800 }, { outstanding_balance: 60400 }), null);
  assert.equal(totalOutstanding(null, null), null);
});

test("outstandingPrincipal reads outstanding_principal from either source", () => {
  assert.equal(outstandingPrincipal({ outstanding_principal: 50000 }, { outstanding_principal: 1 }), 50000);
  assert.equal(outstandingPrincipal(null, { outstanding_principal: "60000" }), 60000);
  assert.equal(outstandingPrincipal({ outstanding_balance: 1 }, { outstanding_balance: 2 }), null);
});

test("totalPayableFigures: before release, Total Payable is a dash and the contract total stands alone", () => {
  assert.deepEqual(totalPayableFigures({ total_payable: null, contract_total: 70800 }), {
    totalPayable: null,
    contractTotal: 70800,
  });
});

test("totalPayableFigures never falls back to a schedule total", () => {
  // A paid-off loan owes 0: that is a real figure, not a gap to fill.
  assert.deepEqual(totalPayableFigures({ total_payable: 0, contract_total: "70800.00" }), {
    totalPayable: 0,
    contractTotal: 70800,
  });
  assert.deepEqual(totalPayableFigures({}), { totalPayable: null, contractTotal: null });
  assert.deepEqual(totalPayableFigures(null), { totalPayable: null, contractTotal: null });
});

test("previewOutstanding reads total_outstanding_before/after, not balance_before/after", () => {
  const preview = {
    balance_before: 60400,
    balance_after: 60000,
    total_outstanding_before: 71200,
    total_outstanding_after: 70200,
  };
  assert.equal(previewOutstandingBefore(preview), 71200);
  assert.equal(previewOutstandingAfter(preview), 70200);
  assert.equal(previewOutstandingAfter({ balance_after: 60000 }), null);
  assert.equal(previewOutstandingBefore(null), null);
  assert.equal(previewOutstandingAfter({ total_outstanding_after: "0.00" }), 0);
});

test("presetButtons: one button per preset the server sent, then Pay all remaining", () => {
  const summary = {
    advance_presets: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ periods: n, amount: n * 100 })),
    payoff_amount: "70800.00",
  };
  assert.deepEqual(presetButtons(summary, 7), [
    { label: "1 period", periods: 1, amount: 100, disabled: false },
    { label: "2 periods", periods: 2, amount: 200, disabled: false },
    { label: "3 periods", periods: 3, amount: 300, disabled: false },
    { label: "6 periods", periods: 6, amount: 600, disabled: false },
    { label: "Pay all remaining", periods: 7, amount: 70800, disabled: false },
  ]);
});

test("presetButtons on a Share Capital Build-Up loan: only the 1-period preset and payoff", () => {
  const summary = { advance_presets: [{ periods: 1, amount: 11900 }], payoff_amount: 70800 };
  assert.deepEqual(
    presetButtons(summary, 6).map((b) => [b.label, b.amount]),
    [
      ["1 period", 11900],
      ["Pay all remaining", 70800],
    ],
  );
});

test("presetButtons: Pay all remaining reads payoff_amount, a dash and disabled when not sent", () => {
  const buttons = presetButtons({ advance_presets: [{ periods: 1, amount: 100 }] }, 3);
  assert.deepEqual(buttons.at(-1), { label: "Pay all remaining", periods: 3, amount: null, disabled: true });
  // Never the presets added up, never the last preset standing in.
  assert.deepEqual(presetButtons(null, 2), [
    { label: "Pay all remaining", periods: 2, amount: null, disabled: true },
  ]);
});
