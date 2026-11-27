import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { missingAccessPlacement, missingLoanFormAccess, type LoanFormAccess } from "./missing-access";

const ALL: LoanFormAccess = {
  members: true,
  products: true,
  collaterals: true,
  shareCapital: true,
};

describe("missingLoanFormAccess", () => {
  test("nothing is missing for a user who holds every read", () => {
    assert.deepEqual(missingLoanFormAccess(ALL), []);
  });

  test("fees:view is not asked for: the configured fees come with the server's preview", () => {
    for (const access of [ALL, { ...ALL, members: false, collaterals: false }]) {
      assert.ok(missingLoanFormAccess(access).every((m) => m.permission !== "fees:view"));
    }
  });

  test("a user without borrowers:view is told, and it blocks the form", () => {
    const missing = missingLoanFormAccess({ ...ALL, members: false });
    assert.equal(missing.length, 1);
    assert.equal(missing[0].permission, "borrowers:view");
    assert.equal(missing[0].grant, "Members → View");
    assert.equal(missing[0].blocking, true);
  });

  // An edit's member is fixed (the Chairman/Chairwoman's edit at their
  // approval step is the first edit open to a role without borrowers:view), so
  // the gap only stops co-makers changing and blocks nothing.
  test("on an edit, a user without borrowers:view is told that co-makers can't change, and nothing is blocked", () => {
    const missing = missingLoanFormAccess({ ...ALL, members: false, collaterals: false }, { editing: true });
    assert.deepEqual(missing.map((m) => m.permission), ["borrowers:view", "collaterals:view"]);
    assert.equal(missing[0].effect, "The co-maker pickers can't search members, so co-makers can't be changed.");
    assert.equal(missing[0].grant, "Members → View");
    assert.ok(missing.every((m) => !m.blocking));
  });

  test("blocking gaps come before non-blocking ones", () => {
    const missing = missingLoanFormAccess({ ...ALL, collaterals: false, members: false });
    assert.deepEqual(
      missing.map((m) => m.permission),
      ["borrowers:view", "collaterals:view"],
    );
  });

  test("share capital is not reported when collaterals are hidden anyway", () => {
    const missing = missingLoanFormAccess({ ...ALL, collaterals: false, shareCapital: false });
    assert.deepEqual(missing.map((m) => m.permission), ["collaterals:view"]);
  });

  test("share capital is reported when collaterals are visible", () => {
    const missing = missingLoanFormAccess({ ...ALL, shareCapital: false });
    assert.deepEqual(missing.map((m) => m.permission), ["share_capital:view"]);
  });

  test("the seeded loan_processor (loans:view only) misses every other read", () => {
    const missing = missingLoanFormAccess({
      members: false,
      products: true,
      collaterals: false,
      shareCapital: false,
    });
    assert.deepEqual(
      missing.map((m) => m.permission),
      ["borrowers:view", "collaterals:view"],
    );
  });
});

describe("the share capital notice", () => {
  test("says a new pledge can't be added and a held one stays attached", () => {
    const missing = missingLoanFormAccess({ ...ALL, shareCapital: false });
    const notice = missing.find((m) => m.permission === "share_capital:view");
    assert.ok(notice);
    assert.match(notice.effect, /can't be added/);
    assert.match(notice.effect, /already holds stays attached/);
    assert.doesNotMatch(notice.effect, /can't be attached/);
  });
});

// The approval edit fits the screen at 1024x640 (UI round): nothing it can't
// see stacks above the form, so the form body keeps its fields. The member gap
// reads beside the co-maker pickers; the collateral step isn't shown at all.
describe("missingAccessPlacement", () => {
  const chair = missingLoanFormAccess({ ...ALL, members: false, collaterals: false }, { editing: true });

  test("the approval edit puts nothing above the form and names the member gap beside the co-makers", () => {
    assert.deepEqual(missingAccessPlacement(chair, true), {
      aboveForm: [],
      coMakersNote: "The co-maker pickers can't search members, so co-makers can't be changed.",
    });
  });

  test("the approval edit with nothing missing has no note", () => {
    assert.deepEqual(missingAccessPlacement([], true), { aboveForm: [], coMakersNote: null });
  });

  test("every other mode keeps the notice above the form, as before", () => {
    assert.deepEqual(missingAccessPlacement(chair, false), { aboveForm: chair, coMakersNote: null });
  });
});
