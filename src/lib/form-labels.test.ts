import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The label points at the select's trigger, which carries that id once. */
function assertSelectLabelled(source: string, page: string, label: string, id: string): void {
  assert.match(source, new RegExp(`<Label htmlFor="${id}">\\s*${escape(label)}`), `${page}: ${label} label`);
  assert.match(source, new RegExp(`<SelectTrigger id="${id}"`), `${page}: ${label} trigger`);
  assert.equal(source.split(`id="${id}"`).length - 1, 1, `${page}: ${label} id is unique`);
}

const memberForms = {
  "new member page": read("src/app/(app)/borrowers/new/page.tsx"),
  "edit member page": read("src/app/(app)/borrowers/[id]/edit/page.tsx"),
};

for (const [page, source] of Object.entries(memberForms)) {
  test(`the ${page} links Suffix, Gender and Civil Status to their inputs`, () => {
    assertSelectLabelled(source, page, "Suffix", "suffix");
    assertSelectLabelled(source, page, "Civil Status", "civil_status");
    assert.match(source, /<Label id="gender-label">\s*Gender/, `${page}: Gender label`);
    assert.match(source, /<RadioGroup\s+aria-labelledby="gender-label"/, `${page}: Gender group`);
  });
}

test("the edit member page links Assigned Branch to its select", () => {
  assertSelectLabelled(memberForms["edit member page"], "edit member page", "Assigned Branch", "member-branch");
});

test("the new member page keeps its Branch label linked", () => {
  assertSelectLabelled(memberForms["new member page"], "new member page", "Branch", "member-branch");
});

test("the Amortization Calculator links Rate Per, Term Unit and Payment Frequency", () => {
  const source = read("src/app/(app)/loans/amortization/page.tsx");
  const page = "Amortization Calculator";
  assertSelectLabelled(source, page, "Rate Per *", "rateFrequency");
  assertSelectLabelled(source, page, "Term Unit *", "termUnit");
  assertSelectLabelled(source, page, "Payment Frequency *", "frequency");
});
