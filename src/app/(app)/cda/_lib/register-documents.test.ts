import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  documentsCountLabel,
  linkedDocumentSubject,
  registerDocumentsHref,
  subjectDocumentsParams,
} from "./register-documents";

test("a row's documents open the documents list filtered to that row, in its own year", () => {
  assert.equal(
    registerDocumentsHref({ type: "training", id: 7 }, 2025),
    "/cda/documents?year=2025&subject_type=training&subject_id=7",
  );
  assert.equal(
    registerDocumentsHref({ type: "case", id: 12 }, 2026),
    "/cda/documents?year=2026&subject_type=case&subject_id=12",
  );
});

test("the documents list reads the row it is filtered to from its address", () => {
  assert.deepEqual(linkedDocumentSubject("subject_type=program&subject_id=4&year=2026"), { type: "program", id: 4 });
  assert.equal(linkedDocumentSubject("subject_type=loan&subject_id=4"), null);
  assert.equal(linkedDocumentSubject("subject_type=case&subject_id=abc"), null);
  assert.equal(linkedDocumentSubject("subject_type=case&subject_id=0"), null);
  assert.equal(linkedDocumentSubject("subject_type=case"), null);
  assert.equal(linkedDocumentSubject("year=2026"), null);
});

test("a filtered list asks the server for that row's active documents, as its count does", () => {
  assert.deepEqual(subjectDocumentsParams({ type: "training", id: 7 }), {
    subject_type: "training",
    subject_id: 7,
    status: "active",
  });
  assert.equal(subjectDocumentsParams(null), undefined);
});

test("the count reads in words", () => {
  assert.equal(documentsCountLabel(0), "No documents");
  assert.equal(documentsCountLabel(1), "1 document");
  assert.equal(documentsCountLabel(3), "3 documents");
  assert.equal(documentsCountLabel(undefined), null);
});

test("each register row shows its count, and the documents list filters by the row", () => {
  const cda = join(process.cwd(), "src/app/(app)/cda");
  for (const [file, type] of [
    ["officers/_components/registers.tsx", "training"],
    ["social-audit/_components/programs.tsx", "program"],
    ["mediation/_components/cases.tsx", "case"],
  ]) {
    const source = readFileSync(join(cda, file), "utf8");
    assert.match(source, new RegExp(`<RegisterDocumentsLink[\\s\\S]*?type: "${type}"[\\s\\S]*?count=\\{r\\.documents_count\\}`), file);
  }
  const documents = readFileSync(join(cda, "documents/_components/documents.tsx"), "utf8");
  assert.match(documents, /cdaService\.listDocuments\(year, subjectDocumentsParams\(subject\)\)/);
});
