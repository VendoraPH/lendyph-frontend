import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** Documents whose legal text says "Borrower": R.A. 3765 and the loan contract use the term. */
const LEGAL_DOCUMENTS = [
  "src/lib/printables/templates/disclosure.ts",
  "src/lib/printables/templates/promissory-note.ts",
  "src/lib/printables/templates/demand-letter.ts",
  "src/lib/printables/templates/amortization-schedule.ts",
];

const sourceFiles = () =>
  execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
    .split("\n")
    .filter((path) => /\.tsx?$/.test(path) && !path.endsWith(".test.ts"));

const codeLines = (text: string) =>
  text.split("\n").filter((line) => !/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(line));

describe('users read "Member"', () => {
  // Quoted text only: types and identifiers such as `Borrower[]` keep their names.
  test('no quoted text says "Borrower" outside the legal documents', () => {
    const quoted = /(["'`])[^"'`]*\bBorrowers?\b[^"'`]*\1/;
    const found = sourceFiles()
      .filter((path) => !LEGAL_DOCUMENTS.includes(path))
      .flatMap((path) =>
        codeLines(source(path))
          .filter((line) => quoted.test(line))
          .map((line) => `${path}: ${line.trim()}`),
      );
    assert.deepEqual(found, []);
  });

  test("the receipt and the voucher don't say Borrower", () => {
    for (const path of [
      "src/lib/printables/templates/official-receipt.ts",
      "src/lib/printables/templates/release-voucher.ts",
    ]) {
      assert.deepEqual(
        codeLines(source(path)).filter((line) => /\bBorrower\b(?!\w)/.test(line) && /["'`]/.test(line)),
        [],
      );
    }
  });
});

describe('legal documents keep "Borrower"', () => {
  test("the disclosure statement names the Borrower and has them sign", () => {
    const text = source("src/lib/printables/templates/disclosure.ts");
    assert.match(text, /"Name of Borrower"/);
    assert.match(text, /"Borrower — Signature Over Printed Name"/);
  });

  test("the promissory note binds the Maker / Borrower", () => {
    assert.match(source("src/lib/printables/templates/promissory-note.ts"), /"Maker \/ Borrower"/);
  });

  test("the amortization schedule says Borrower on its signature line only", () => {
    const text = source("src/lib/printables/templates/amortization-schedule.ts");
    assert.match(text, /"Borrower — Signature Over Printed Name"/);
    assert.doesNotMatch(text, /field\("Borrower"/);
    assert.match(text, /field\("Member"/);
  });
});

describe('"For review" is gone from the loan screens', () => {
  test("the loan page and approval settings say for approval", () => {
    assert.doesNotMatch(source("src/app/(app)/loans/[id]/page.tsx"), /submitted for\s+review/);
    assert.match(source("src/app/(app)/loans/[id]/page.tsx"), /submitted for\s+approval/);
    assert.match(
      source("src/app/(app)/settings/approval-workflow/page.tsx"),
      /submits the draft for approval/,
    );
  });
});
