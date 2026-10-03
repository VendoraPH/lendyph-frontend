import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { missingLoanFormAccess, type LoanFormAccess } from "./missing-access";

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
