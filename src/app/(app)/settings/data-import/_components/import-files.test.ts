import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FILE_LABELS, FILE_SLOTS, FILES_RULE, fileNameInSentence, filesProblem } from "./import-files";

const MEMBERS = { name: "members.csv" };
const LOANS = { name: "loans.csv" };

test("members alone, or members with loans, can be imported", () => {
  assert.equal(filesProblem({ customers: MEMBERS, loans: null }), null);
  assert.equal(filesProblem({ customers: MEMBERS, loans: LOANS }), null);
});

test("a loans file alone is refused, in the server's own words", () => {
  assert.equal(
    filesProblem({ customers: null, loans: LOANS }),
    "A loans file needs its members file in the same import. Pick the members file too.",
  );
  assert.equal(filesProblem({ customers: null, loans: null }), "Pick the members file to continue.");
});

test("the members slot is required and the loans slot optional, as the rule says", () => {
  assert.equal(
    FILES_RULE,
    "The members file is required; the loans file is optional (it needs its members in the same import).",
  );
  assert.deepEqual(
    FILE_SLOTS.map((slot) => [slot.kind, slot.label, slot.optional]),
    [
      ["customers", "Members file", false],
      ["loans", "Loans file", true],
    ],
  );
});

test("the import calls its files by the Prepare step's names on every step", () => {
  assert.deepEqual(FILE_LABELS, { customers: "Members file", loans: "Loans file" });
  assert.deepEqual(FILE_SLOTS.map((slot) => slot.label), [FILE_LABELS.customers, FILE_LABELS.loans]);
  assert.equal(fileNameInSentence("customers"), "members file");
  assert.equal(fileNameInSentence("loans"), "loans file");

  // Check, Upload and Result take the names from here, never a copy of their own.
  for (const file of [
    "_hooks/use-file-precheck.ts",
    "_components/step-upload.tsx",
    "_components/outcome-tiles.tsx",
  ]) {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/settings/data-import", file), "utf8");
    assert.match(source, /FILE_LABELS|fileNameInSentence/, file);
    assert.doesNotMatch(source, /"Customer Profile"|KIND_LABEL|kind === "loans" \? "Loans" : "Members"/, file);
  }
});

test("the Prepare step states the rule and draws its slots from the table", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/(app)/settings/data-import/_components/step-prepare.tsx"),
    "utf8",
  );
  assert.match(source, /\{FILES_RULE\}/);
  assert.match(source, /FILE_SLOTS\.map\(/);
  assert.match(source, /filesProblem\(files\)/);
  assert.doesNotMatch(source, /At least one file is required/);
  assert.doesNotMatch(source, /no members will be created/);
});
