import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FILE_LABELS,
  FILE_SLOTS,
  FILES_RULE,
  fileNameInSentence,
  filesPhrase,
  filesProblem,
  runFileKinds,
} from "./import-files";

const STEPS = "src/app/(app)/settings/data-import/_components";

test("a run's own files are read off whatever map it keeps them in", () => {
  assert.deepEqual(runFileKinds({ customers: { id: 1 } }), ["customers"]);
  assert.deepEqual(runFileKinds({ loans: { id: 2 }, customers: { id: 1 } }), ["customers", "loans"]);
  assert.deepEqual(runFileKinds(undefined), []);
});

test("the run's files are spoken of as the one file, both, or, before they are known, yours", () => {
  assert.deepEqual(filesPhrase(["customers"]), {
    verified: "The members file is on the server and verified",
    announced: "The members file is uploaded and verified.",
    sent: "of the members file sent",
    copies: "the copy on your computer is",
    everyRow: "Every row in the members file",
    stillRead: "the members file is still being read",
    again: "the members file",
  });
  assert.deepEqual(filesPhrase(["customers", "loans"]), {
    verified: "Both files are on the server and verified",
    announced: "Both files uploaded and verified.",
    sent: "of both files sent",
    copies: "the copies on your computer are",
    everyRow: "Every row in both files",
    stillRead: "the files are still being read",
    again: "the files",
  });
  assert.equal(filesPhrase([]).verified, "Your files are on the server and verified");
  assert.doesNotMatch(Object.values(filesPhrase([])).join(" "), /[Bb]oth/);
});

test("Processing, the result and a resumed check speak of the run's own files", () => {
  const read = (file: string) => readFileSync(join(process.cwd(), STEPS, file), "utf8");

  const processing = read("step-processing.tsx");
  assert.match(processing, /filesPhrase\(runFileKinds\(status\?\.files\)\)/);
  assert.doesNotMatch(processing, /Both files are on the server/);
  assert.doesNotMatch(processing, /the files are still being read/);

  const result = read("step-result.tsx");
  assert.match(result, /const kinds = runFileKinds\(status\.files\)/);
  assert.match(result, /filesPhrase\(kinds\)/);
  assert.doesNotMatch(result, /Every row in both files/);
  // Counted separately is only worth saying when there are two files to count.
  assert.match(result, /kinds\.length > 1 \? \(\s*<p/);

  const check = read("step-check.tsx");
  assert.match(check, /const storedKinds = runFileKinds\(stored\.files\)/);
  assert.match(check, /filesPhrase\(storedKinds\)/);
  assert.doesNotMatch(check, /Choose the files again/);
  // The loan product count only for a run that has a loans file.
  assert.match(check, /storedKinds\.includes\("loans"\) \? \(/);
});

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
