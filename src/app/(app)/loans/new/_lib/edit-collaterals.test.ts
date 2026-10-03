import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { CollateralType, LoanCollateral } from "@/types/collateral";
import {
  attachedCollateralRows,
  collateralSaveBlock,
  editCollateralLoad,
  editedCollaterals,
  tracksEditCollaterals,
  type EditCollateralResult,
  type SelectedCollateral,
} from "./edit-collaterals";

const LOAN_ID = 7;

const LAND: CollateralType = {
  id: 1,
  name: "Land Title",
  detail_field_label: "Title No.",
  amount_field_label: "Appraised Value",
  source: "manual",
  display_order: 1,
  is_visible: true,
  is_seed: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

/** A row of `GET /loans/{id}/collaterals`, as `CollateralResource` sends it. */
function link(id: number, snapshot: number, extra: Partial<LoanCollateral> = {}): LoanCollateral {
  return {
    id,
    borrower_id: 3,
    collateral_type_id: LAND.id,
    detail_value: `TCT-${id}`,
    amount: snapshot + 1000,
    effective_value: snapshot + 1000,
    value_unknown: false,
    collateral_type: LAND,
    active_loans: [{ id: LOAN_ID, loan_account_number: "LN-0007" }],
    pivot: { loan_id: LOAN_ID, snapshot_value: snapshot, attached_at: "2026-02-01T00:00:00Z" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

/** A collateral picked from the member's list, booked at its live value. */
function picked(id: number, value: number): SelectedCollateral {
  const [row] = attachedCollateralRows([link(id, value, { active_loans: [] })], LOAN_ID);
  return { collateral: { ...row.collateral, effective_value: value }, snapshot_value: value };
}

const ready = (attached: SelectedCollateral[]): EditCollateralResult => ({
  request: "7:0",
  attached,
  error: null,
});

describe("edit mode's collateral load state", () => {
  test("loading until the loan's collaterals are read, and Save is held", () => {
    const load = editCollateralLoad(null, "7:0");
    assert.equal(load, "loading");
    assert.match(collateralSaveBlock(load) ?? "", /once this loan's collaterals have loaded/);
  });

  test("a failed read is an error, and Save stays held with a reason", () => {
    const load = editCollateralLoad({ request: "7:0", attached: null, error: "Please try again." }, "7:0");
    assert.equal(load, "error");
    assert.match(collateralSaveBlock(load) ?? "", /Retry in the Collaterals card/);
  });

  test("a successful read is ready, and Save is free", () => {
    const load = editCollateralLoad(ready(attachedCollateralRows([link(1, 50_000)], LOAN_ID)), "7:0");
    assert.equal(load, "ready");
    assert.equal(collateralSaveBlock(load), null);
  });

  test("a loan with no collaterals attached still reaches ready", () => {
    assert.equal(editCollateralLoad(ready(attachedCollateralRows([], LOAN_ID)), "7:0"), "ready");
  });

  test("ready needs only the loan's own read, not the member's registered collaterals", () => {
    // Built from the link rows alone: no collateral types and no member list
    // go in, so a member with none registered, or a list that is slow or
    // failed, cannot hold the form at loading.
    const rows = attachedCollateralRows([link(1, 50_000)], LOAN_ID);
    assert.equal(rows.length, 1);
    assert.equal(editCollateralLoad(ready(rows), "7:0"), "ready");
  });

  test("an answer to an earlier read (before a Retry) is not taken as current", () => {
    const failed: EditCollateralResult = { request: "7:0", attached: null, error: "Please try again." };
    assert.equal(editCollateralLoad(failed, "7:1"), "loading");
  });

  test("a role without collaterals:view, or a new application, is not tracked and never held", () => {
    assert.equal(tracksEditCollaterals(true, false), false);
    assert.equal(tracksEditCollaterals(false, true), false);
    assert.equal(tracksEditCollaterals(true, true), true);
    assert.equal(collateralSaveBlock(null), null);
  });
});

describe("attachedCollateralRows", () => {
  test("keeps every attached collateral, booked at its snapshot, from the link row itself", () => {
    // Collateral 9 is not in the member's list the picker reads (for example
    // that list failed, or was cut short). It must still be on the form.
    const rows = attachedCollateralRows([link(1, 50_000), link(9, 120_000)], LOAN_ID);

    assert.deepEqual(rows.map((r) => r.collateral.id), [1, 9]);
    assert.deepEqual(rows.map((r) => r.snapshot_value), [50_000, 120_000]);
    assert.equal(rows[1].collateral.type?.name, "Land Title");
    assert.equal(rows[1].collateral.detail_value, "TCT-9");
  });

  test("the loan being edited is not a conflict with itself", () => {
    const [row] = attachedCollateralRows([link(1, 50_000)], LOAN_ID);
    assert.equal(row.collateral.lock.state, "free");
  });

  test("another active holder is still shown as one", () => {
    const [row] = attachedCollateralRows(
      [link(1, 50_000, { active_loans: [{ id: LOAN_ID, loan_account_number: "LN-0007" }, { id: 8, loan_account_number: "LN-0008" }] })],
      LOAN_ID,
    );
    assert.equal(row.collateral.lock.state, "held");
  });
});

describe("editedCollaterals: the `collaterals` key of an edit", () => {
  const attached = attachedCollateralRows([link(1, 50_000), link(9, 120_000)], LOAN_ID);

  test("omitted when the selection is what the loan already holds", () => {
    assert.deepEqual(editedCollaterals(attached, attached), {});
  });

  test("omitted when only the order differs", () => {
    assert.deepEqual(editedCollaterals([...attached].reverse(), attached), {});
  });

  test("the full list when one is removed", () => {
    assert.deepEqual(editedCollaterals([attached[1]], attached), {
      collaterals: [{ collateral_id: 9, snapshot_value: 120_000 }],
    });
  });

  test("the full list when one is added, the new one at the value the page shows", () => {
    assert.deepEqual(editedCollaterals([...attached, picked(4, 30_000)], attached), {
      collaterals: [
        { collateral_id: 1, snapshot_value: 50_000 },
        { collateral_id: 9, snapshot_value: 120_000 },
        { collateral_id: 4, snapshot_value: 30_000 },
      ],
    });
  });

  test("an empty list when every one is removed", () => {
    assert.deepEqual(editedCollaterals([], attached), { collaterals: [] });
  });

  test("never sent when the form does not state the loan's collaterals", () => {
    // `attached` is null for a role without collaterals:view or
    // collaterals:update, and before the loan's collaterals have loaded.
    assert.deepEqual(editedCollaterals([picked(4, 30_000)], null), {});
    assert.deepEqual(editedCollaterals([], null), {});
  });
});
