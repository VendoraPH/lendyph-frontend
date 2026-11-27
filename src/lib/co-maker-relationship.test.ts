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

test("the loan page's co-maker list and the member Loans tab read relationships through it, with no CSS capitalising", () => {
  const release = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/_components/release-co-makers.tsx"), "utf8");
  assert.ok(release.includes("relationshipInWords(cm.relationship_to_borrower)"));
  const loansTab = readFileSync(join(process.cwd(), "src/app/(app)/borrowers/[id]/_components/loans-tab.tsx"), "utf8");
  assert.ok(loansTab.includes("relationshipInWords(cm.relationship_to_borrower)"));
  for (const source of [release, loansTab]) {
    assert.doesNotMatch(source, /capitalize">\s*\{[^}]*relationship_to_borrower/);
    assert.doesNotMatch(source, /className="[^"]*\bcapitalize\b[^"]*">\s*\{\[?cm\.relationship_to_borrower/);
  }
});
