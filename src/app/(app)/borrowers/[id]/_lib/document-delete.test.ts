import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deleteDocumentLabel, documentName } from "./document-delete";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/borrowers/[id]/_components/documents-tab.tsx"),
  "utf8",
);

test("a document reads by its label, else by its number", () => {
  assert.equal(documentName({ id: 7, label: "Payslip June.pdf" }), "Payslip June.pdf");
  assert.equal(documentName({ id: 7, label: "  " }), "Document #7");
  assert.equal(documentName({ id: 7 }), "Document #7");
});

test("the delete button's accessible name names the document", () => {
  assert.equal(deleteDocumentLabel({ id: 7, label: "Payslip June.pdf" }), "Delete Payslip June.pdf");
  assert.equal(deleteDocumentLabel({ id: 9 }), "Delete Document #9");
});

test("the documents tab asks before deleting, in the app's own dialog", () => {
  assert.ok(source.includes("<AlertDialog"), "uses AlertDialog");
  assert.ok(source.includes("<AlertDialogCancel"), "has a Cancel");
  assert.ok(!/window\.confirm|\bconfirm\(/.test(source), "never window.confirm");
  assert.ok(source.includes("aria-label={deleteDocumentLabel(doc)}"), "the icon button has a name");
  // The row's icon only opens the dialog; the delete runs from its Delete button.
  const calls = source.match(/handleDeleteDocument\(/g) ?? [];
  assert.equal(calls.length, 2, "defined once and called once");
  const action = source.slice(source.indexOf("<AlertDialogAction"));
  assert.ok(action.slice(0, 400).includes("handleDeleteDocument("), "called from the dialog's Delete");
});
