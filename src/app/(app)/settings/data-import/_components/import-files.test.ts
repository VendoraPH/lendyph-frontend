import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FILE_SLOTS, FILES_RULE, filesProblem } from "./import-files";

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
