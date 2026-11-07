import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { documentTypeFromName } from "./document-type";

test("a file's type is its extension, in lower case", () => {
  assert.equal(documentTypeFromName("Contract.PDF"), "pdf");
  assert.equal(documentTypeFromName("scan.final.docx"), "docx");
  assert.equal(documentTypeFromName("photo.mp4"), "mp4");
});

test("a name with no dot reads as a file, not the whole name", () => {
  assert.equal(documentTypeFromName("Scan (1)"), "file");
  assert.equal(documentTypeFromName("Scan"), "file");
  assert.equal(documentTypeFromName(""), "file");
});

test("an extension that isn't plain letters and digits reads as a file", () => {
  assert.equal(documentTypeFromName("Scan."), "file");
  assert.equal(documentTypeFromName("v1.2 (final)"), "file");
  assert.equal(documentTypeFromName("report.pdf "), "file");
  assert.equal(documentTypeFromName("a.b-c"), "file");
  assert.equal(documentTypeFromName("larawan.añb"), "file");
});

test("every type it answers is one the server accepts", () => {
  const accepted = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;
  for (const name of ["Scan (1)", "a.pdf", "x.", ".", "..", "a.$$$", "résumé"]) {
    assert.match(documentTypeFromName(name), accepted);
  }
});

test("all three Documents screens read the type from it", () => {
  for (const path of [
    "src/app/(app)/borrowers/[id]/_components/documents-tab.tsx",
    "src/app/(app)/borrowers/[id]/_components/co-maker-documents-dialog.tsx",
    "src/app/(app)/loans/[id]/_components/loan-documents-card.tsx",
  ]) {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    assert.match(source, /documentTypeFromName\(file\.name\)/, path);
    assert.doesNotMatch(source, /file\.name\.split/, path);
  }
});
