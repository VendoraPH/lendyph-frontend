import { test } from "node:test";
import assert from "node:assert/strict";
import { loanDocumentService } from "@/services";
import { findPrintable } from "./catalog";

/**
 * The document carries the loan it was built from, which the print log needs.
 * A failed read opens a blank form instead, and a blank form is not that loan's
 * document, so it carries no loan and logs nothing.
 */

const org = { name: null, logoUrl: null };

test("a document built from its record carries the loan's id", async () => {
  const original = loanDocumentService.disclosure;
  loanDocumentService.disclosure = (async () => ({})) as unknown as typeof original;
  try {
    const doc = await findPrintable("disclosure_statement")!.build({ subjectId: 42, org });
    assert.equal(doc.subjectId, 42);
  } finally {
    loanDocumentService.disclosure = original;
  }
});

test("the blank form a failed read falls back to carries no loan", async () => {
  const original = loanDocumentService.promissoryNote;
  loanDocumentService.promissoryNote = (async () => {
    throw new Error("422");
  }) as unknown as typeof original;
  try {
    const doc = await findPrintable("promissory_note")!.build({ subjectId: 42, org });
    assert.equal(doc.subjectId, undefined);
  } finally {
    loanDocumentService.promissoryNote = original;
  }
});
