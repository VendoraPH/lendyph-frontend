import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Borrower, GCashNonMember } from "@/types";
import {
  combineShortfalls,
  memberOption,
  partyKindLabel,
  partyOptionValue,
  walkInOption,
  type GCashPartyListState,
} from "./party-options";

function walkIn(overrides: Partial<GCashNonMember> = {}): GCashNonMember {
  return {
    id: 1,
    full_name: "Juan Dela Cruz",
    mobile_number: "09171234567",
    id_type: "UMID",
    id_number: "0111-2222333-4",
    remarks: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function member(overrides: Partial<Borrower> = {}): Borrower {
  return {
    id: 1,
    full_name: "Juan Dela Cruz",
    borrower_code: "M-0001",
    contact_number: "09170000000",
    ...overrides,
  } as Borrower;
}

/** A list whose rows are irrelevant, only how many there are. */
function list(
  count: number,
  shortfall: GCashPartyListState["shortfall"] = null,
): GCashPartyListState {
  return {
    options: Array.from({ length: count }, (_, i) =>
      walkInOption(walkIn({ id: i + 1 })),
    ),
    shortfall,
  };
}

describe("picker row values", () => {
  test("REGRESSION: two walk-ins who look alike get different values", () => {
    // Same name, mobile and ID number, different ID type: two real records
    // whose search text is identical. cmdk highlights by value, so a shared
    // value lit up both rows at once.
    const a = walkInOption(walkIn({ id: 10, id_type: "UMID" }));
    const b = walkInOption(walkIn({ id: 11, id_type: "SSS" }));
    assert.notEqual(partyOptionValue(a), partyOptionValue(b));
  });

  test("a member and a walk-in with the same id do not share a value", () => {
    const m = memberOption(member({ id: 7 }));
    const w = walkInOption(walkIn({ id: 7 }));
    assert.notEqual(partyOptionValue(m), partyOptionValue(w));
  });

  test("the value is the same row's value every time", () => {
    const w = walkIn({ id: 3 });
    assert.equal(
      partyOptionValue(walkInOption(w)),
      partyOptionValue(walkInOption({ ...w, full_name: "Renamed" })),
      "renaming a walk-in must not change which row is highlighted",
    );
  });
});

describe("picker row labels", () => {
  test("members are labelled Member", () => {
    assert.equal(partyKindLabel(memberOption(member()).party), "Member");
  });

  test("walk-ins are labelled Walk-in", () => {
    assert.equal(partyKindLabel(walkInOption(walkIn()).party), "Walk-in");
  });
});

describe("walk-in rows", () => {
  test("carry the record, so the selected walk-in can be edited", () => {
    const w = walkIn({ id: 4, remarks: "Regular" });
    assert.deepEqual(walkInOption(w).nonMember, w);
  });

  test("show the presented ID and the mobile number", () => {
    const option = walkInOption(walkIn());
    assert.equal(option.hint, "UMID · 0111-2222333-4");
    assert.equal(option.contactNumber, "09171234567");
  });

  test("members carry no walk-in record", () => {
    assert.equal(memberOption(member()).nonMember, null);
  });
});

describe("showing X of Y across both lists", () => {
  test("both lists complete: no notice", () => {
    assert.equal(combineShortfalls(list(5), list(3)), null);
  });

  test("REGRESSION: only the members are cut off — the count still shows", () => {
    // The walk-ins came back whole, so their total is simply how many there
    // are. Treating "no shortfall" as "unknown total" blanked the figure.
    assert.deepEqual(
      combineShortfalls(list(2000, { shown: 2000, total: 2400 }), list(30)),
      { shown: 2030, total: 2430 },
    );
  });

  test("REGRESSION: only the walk-ins are cut off — the count still shows", () => {
    assert.deepEqual(
      combineShortfalls(list(12), list(2000, { shown: 2000, total: 2100 })),
      { shown: 2012, total: 2112 },
    );
  });

  test("both cut off: the totals add up", () => {
    assert.deepEqual(
      combineShortfalls(
        list(2000, { shown: 2000, total: 2500 }),
        list(2000, { shown: 2000, total: 2200 }),
      ),
      { shown: 4000, total: 4700 },
    );
  });

  test("a cut-off list with no known total leaves the total unknown", () => {
    assert.deepEqual(
      combineShortfalls(list(2000, { shown: 2000, total: null }), list(30)),
      { shown: 2030, total: null },
    );
  });
});
