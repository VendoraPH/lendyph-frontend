import { test } from "node:test";
import assert from "node:assert/strict";
import { collapsedNavLabel, countLabel, newLabel } from "./sidebar-labels";

test("collapsedNavLabel names every icon-only link by its menu title", () => {
  assert.equal(collapsedNavLabel("Dashboard"), "Dashboard");
  assert.equal(collapsedNavLabel("GCash", undefined), "GCash");
});

test("collapsedNavLabel puts the title before a badge's count", () => {
  assert.equal(
    collapsedNavLabel("Loans", "3 loan applications awaiting approval"),
    "Loans, 3 loan applications awaiting approval",
  );
});

test("countLabel pluralises and is absent with nothing to count", () => {
  assert.equal(countLabel(1, "registration", "awaiting review"), "1 registration awaiting review");
  assert.equal(countLabel(3, "registration", "awaiting review"), "3 registrations awaiting review");
  assert.equal(countLabel(0, "registration", "awaiting review"), undefined);
  assert.equal(countLabel(undefined, "registration", "awaiting review"), undefined);
});

test("newLabel says how many are new in the section, in words, and nothing at zero", () => {
  assert.equal(newLabel(1, "Loans"), "1 new in Loans");
  assert.equal(newLabel(4, "Savings Approvals"), "4 new in Savings Approvals");
  assert.equal(newLabel(0, "Loans"), undefined);
  assert.equal(newLabel(undefined, "Loans"), undefined);
});
