import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balanceAdjustmentNewValues,
  readBalanceAdjustmentPreview,
  targetPrincipalInput,
} from "./balance-adjustment";

test("a typed target principal is sent as typed, trimmed", () => {
  assert.equal(targetPrincipalInput(" 1500.5 "), "1500.5");
  assert.equal(targetPrincipalInput("0"), "0");
  assert.equal(targetPrincipalInput("3000.00"), "3000.00");
});

test("a target the server would refuse is not asked about", () => {
  for (const raw of ["", "  ", "-1", "1.234", "1,500", "abc", ".5", "1e3"]) {
    assert.equal(targetPrincipalInput(raw), null, raw);
  }
});

test("the request carries the target principal, never an amount worked out here", () => {
  const values = balanceAdjustmentNewValues("2500.75");
  assert.deepEqual(values, { target_principal_balance: "2500.75" });
  assert.equal("adjustment_amount" in values, false);
});

test("the preview shows the server's figures as sent", () => {
  // Figures that do not add up on purpose: the dialog repeats the server, it
  // does not check its arithmetic.
  assert.deepEqual(
    readBalanceAdjustmentPreview({
      outstanding_principal: "9000.00",
      target_principal_balance: "3000.00",
      adjustment_amount: "-6000.01",
      resulting_principal_balance: "2999.99",
    }),
    { currentPrincipal: 9000, target: 3000, adjustment: -6000.01, resultingPrincipal: 2999.99 },
  );
});

test("numbers off the wire are read too", () => {
  assert.deepEqual(
    readBalanceAdjustmentPreview({
      outstanding_principal: 100,
      target_principal_balance: 0,
      adjustment_amount: -100,
      resulting_principal_balance: 0,
    }),
    { currentPrincipal: 100, target: 0, adjustment: -100, resultingPrincipal: 0 },
  );
});

test("a preview missing a figure is unreadable, not zero", () => {
  assert.equal(readBalanceAdjustmentPreview(null), null);
  assert.equal(
    readBalanceAdjustmentPreview({
      outstanding_principal: "9000.00",
      target_principal_balance: "3000.00",
      resulting_principal_balance: "3000.00",
    }),
    null,
  );
  assert.equal(
    readBalanceAdjustmentPreview({
      outstanding_principal: "n/a",
      target_principal_balance: "3000.00",
      adjustment_amount: "-6000.00",
      resulting_principal_balance: "3000.00",
    }),
    null,
  );
});
