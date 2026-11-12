import { test } from "node:test";
import assert from "node:assert/strict";
import { loanDocumentService } from "@/services";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrintableRefusedError, findPrintable } from "./catalog";

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

function httpError(status: number, data: unknown) {
  return { isAxiosError: true, response: { status, data } };
}

test("a loan the server refuses (422) opens nothing and carries the server's message", async () => {
  const original = loanDocumentService.disclosure;
  const message = "The disclosure statement can be printed once the loan is approved.";
  loanDocumentService.disclosure = (async () => {
    throw httpError(422, { message, errors: { loan: [message] } });
  }) as unknown as typeof original;
  try {
    await assert.rejects(
      findPrintable("disclosure_statement")!.build({ subjectId: 42, org }),
      (err: unknown) => err instanceof PrintableRefusedError && err.message === message,
    );
  } finally {
    loanDocumentService.disclosure = original;
  }
});

test("a server error that isn't a refusal still falls back to the blank form", async () => {
  const original = loanDocumentService.promissoryNote;
  loanDocumentService.promissoryNote = (async () => {
    throw httpError(500, { message: "Server Error" });
  }) as unknown as typeof original;
  try {
    const doc = await findPrintable("promissory_note")!.build({ subjectId: 42, org });
    assert.equal(doc.subjectId, undefined);
  } finally {
    loanDocumentService.promissoryNote = original;
  }
});

test("every place that opens a document shows a refusal's own message", () => {
  for (const file of [
    "src/hooks/use-printables.ts",
    "src/app/(app)/printables/[printableId]/page.tsx",
    "src/lib/savings/print-document.ts",
  ]) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /err instanceof PrintableRefusedError\s*\?\s*err\.message/, file);
  }
});
