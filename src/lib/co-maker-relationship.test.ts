import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RELATIONSHIP_OPTIONS } from "@/constants";
import { relationshipInWords } from "./co-maker-relationship";

test("a stored relationship reads as its label", () => {
  assert.equal(relationshipInWords("sibling"), "Sibling");
  assert.equal(relationshipInWords("spouse"), "Spouse");
  for (const option of RELATIONSHIP_OPTIONS) {
    assert.equal(relationshipInWords(option.value), option.label);
  }
});

test("a relationship typed on the loan screen reads as itself, and none as a dash", () => {
  assert.equal(relationshipInWords("Godmother"), "Godmother");
  assert.equal(relationshipInWords(null), "—");
  assert.equal(relationshipInWords(undefined), "—");
  assert.equal(relationshipInWords(""), "—");
});

test("the co-maker card and the co-maker form read relationships through it", () => {
  const card = readFileSync(join(process.cwd(), "src/app/(app)/borrowers/[id]/_components/co-makers-tab.tsx"), "utf8");
  assert.ok(card.includes("relationshipInWords(cm.relationship_to_borrower ?? cm.relationship)"));
  const form = readFileSync(join(process.cwd(), "src/app/(app)/borrowers/[id]/_components/co-maker-form-fields.tsx"), "utf8");
  assert.ok(form.includes("relationshipInWords(value)"));
  assert.ok(!form.includes("RELATIONSHIP_OPTIONS.find("));
});
