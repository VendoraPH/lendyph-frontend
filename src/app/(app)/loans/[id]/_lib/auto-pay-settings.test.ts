import { test } from "node:test";
import assert from "node:assert/strict";
import type { AutoPaySettings } from "@/types/auto-pay";
import { applyAutoPaySettings } from "./auto-pay-settings";

const ENABLED: AutoPaySettings = {
  loan_id: 12,
  auto_pay_enabled: true,
  cbs_reference: "CBS-1",
  enabled_at: "2026-11-07T02:00:00Z",
  enabled_by_user_id: 5,
};

test("turning Auto-Pay on shows what a reload of the loan would show", () => {
  const loan = applyAutoPaySettings({ id: 12, status: "ongoing" }, ENABLED);
  assert.deepEqual(loan, {
    id: 12,
    status: "ongoing",
    auto_pay_enabled: true,
    auto_pay_cbs_reference: "CBS-1",
    auto_pay_enabled_at: "2026-11-07T02:00:00Z",
    auto_pay_enabled_by: 5,
  });
});

test("turning Auto-Pay off clears when and by whom", () => {
  const loan = applyAutoPaySettings(
    {
      id: 12,
      auto_pay_enabled: true,
      auto_pay_cbs_reference: "CBS-1",
      auto_pay_enabled_at: "2026-11-07T02:00:00Z",
      auto_pay_enabled_by: 5,
    },
    { ...ENABLED, auto_pay_enabled: false, cbs_reference: null, enabled_at: null, enabled_by_user_id: null },
  );
  assert.equal(loan.auto_pay_enabled, false);
  assert.equal(loan.auto_pay_cbs_reference, null);
  assert.equal(loan.auto_pay_enabled_at, null);
  assert.equal(loan.auto_pay_enabled_by, null);
});
