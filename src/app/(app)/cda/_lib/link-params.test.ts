import { test } from "node:test";
import assert from "node:assert/strict";
import { linkedPart, withoutParams } from "./link-params";

test("a link's part opens that half of mediation; anything else opens neither", () => {
  assert.equal(linkedPart("h1"), "h1");
  assert.equal(linkedPart("h2"), "h2");
  assert.equal(linkedPart("annual"), null);
  assert.equal(linkedPart("H2"), null);
  assert.equal(linkedPart(null), null);
});

test("a choice made by hand drops its link parameter and keeps the others", () => {
  assert.equal(withoutParams("/cda/mediation", "year=2024&part=h2", ["part"]), "/cda/mediation?year=2024");
  assert.equal(withoutParams("/cda/mediation", "year=2024&part=h2", ["year"]), "/cda/mediation?part=h2");
  assert.equal(withoutParams("/cda/calendar", "year=2024", ["year"]), "/cda/calendar");
  assert.equal(withoutParams("/cda", "", ["year"]), "/cda");
});
