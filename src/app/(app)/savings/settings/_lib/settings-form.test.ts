import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { accountNumberPreview, formToSettings, settingsToForm } from "./settings-form";

const saved = {
  account_number_prefix: "sa",
  account_number_include_branch: true,
  account_number_padding: 6,
  day_count_basis: "365" as const,
  require_reversal_approval: true,
  require_interest_approval: true,
  allow_inactive_member_opening: false,
  dormancy_days: 365,
};

describe("savings settings form", () => {
  test("previews prefix, branch and padded sequence", () => {
    const form = settingsToForm(saved);
    assert.equal(accountNumberPreview(form), "SA-01-000001");
    assert.equal(accountNumberPreview({ ...form, account_number_include_branch: false }, "01", 42), "SA-000042");
    assert.equal(accountNumberPreview({ ...form, account_number_prefix: "" }), "01-000001");
  });

  test("round-trips to the payload with numbers and an upper-case prefix", () => {
    const r = formToSettings(settingsToForm(saved));
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.payload.account_number_prefix, "SA");
      assert.equal(r.payload.account_number_padding, 6);
      assert.equal(r.payload.dormancy_days, 365);
    }
  });

  test("names each bad field", () => {
    const r = formToSettings({
      ...settingsToForm(saved),
      account_number_prefix: "SA-01",
      account_number_padding: "2",
      dormancy_days: "0",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.fields.length, 3);
  });
});
