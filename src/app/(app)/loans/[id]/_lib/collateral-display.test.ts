/**
 * The value the loan's Collaterals card shows for an attached collateral.
 *
 * The card used to read `pivot.snapshot_value ?? amount`. The server sends a
 * null snapshot for a share capital pledge when the viewer may not see share
 * capital balances, and the typed `amount` then stood in: a different figure,
 * shown as if it were the booked one.
 *
 * WHAT THIS PROVES: the card shows the pivot's snapshot value only; a null or
 * missing one is null (a dash on screen), never the collateral's amount, and
 * 0 stays 0.
 * WHAT IT DOES NOT PROVE: who may see the value; that is the backend's test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { attachedCollateralValue } from "./collateral-display";

test("shows the pivot's snapshot value", () => {
  assert.equal(attachedCollateralValue({ amount: 9999, pivot: { snapshot_value: 25000.5 } }), 25000.5);
  assert.equal(attachedCollateralValue({ amount: 9999, pivot: { snapshot_value: "1234.56" } }), 1234.56);
  assert.equal(attachedCollateralValue({ amount: 9999, pivot: { snapshot_value: 0 } }), 0);
});

test("a hidden (null) snapshot is a dash, never the collateral's amount", () => {
  assert.equal(attachedCollateralValue({ amount: 9999, pivot: { snapshot_value: null } }), null);
});

test("no pivot is a dash too, never the collateral's amount", () => {
  assert.equal(attachedCollateralValue({ amount: 9999 }), null);
  assert.equal(attachedCollateralValue({ amount: 9999, pivot: null }), null);
});
