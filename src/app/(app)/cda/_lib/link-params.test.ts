import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { linkedPart, withoutParams, yearChangeAddress } from "./link-params";

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

test("changing the year drops the link's year and a one-row documents filter, and keeps the rest", () => {
  assert.equal(
    yearChangeAddress("/cda/documents", "year=2025&subject_type=training&subject_id=7"),
    "/cda/documents",
  );
  assert.equal(yearChangeAddress("/cda/documents", "subject_type=case&subject_id=3"), "/cda/documents");
  assert.equal(yearChangeAddress("/cda/mediation", "year=2024&part=h2"), "/cda/mediation?part=h2");
});

test("changing the year leaves an address with nothing to drop alone", () => {
  assert.equal(yearChangeAddress("/cda/documents", ""), null);
  assert.equal(yearChangeAddress("/cda/mediation", "part=h1"), null);
});

test("the year picker uses that address", () => {
  const hook = readFileSync(join(process.cwd(), "src/app/(app)/cda/_hooks/use-cda-year-picker.ts"), "utf8");
  assert.match(hook, /yearChangeAddress\(pathname, searchParams\.toString\(\)\)/);
});
