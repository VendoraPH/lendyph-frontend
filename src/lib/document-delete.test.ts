import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deleteDocumentLabel, deleteValidIdLabel, documentName, validIdLabel, validIdName } from "./document-delete";

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

const validId = { id: 3, type: "drivers_license", custom_type_name: null, id_number: "N01-23-456789" };

test("a valid ID reads by its type in words, with its number when it has one", () => {
  assert.equal(validIdLabel(validId), "Driver's License");
  assert.equal(validIdName(validId), "Driver's License N01-23-456789");
  assert.equal(validIdName({ ...validId, id_number: null }), "Driver's License");
  assert.equal(validIdName({ ...validId, type: "others", custom_type_name: "Company ID", id_number: " " }), "Company ID");
  assert.equal(validIdLabel({ ...validId, type: "others", custom_type_name: null }), "Others");
});

test("the valid ID delete button's accessible name names the ID", () => {
  assert.equal(deleteValidIdLabel(validId), "Delete Driver's License N01-23-456789");
});

const dir = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const lists = {
  "member Documents tab": source,
  "co-maker documents dialog": dir("src/app/(app)/borrowers/[id]/_components/co-maker-documents-dialog.tsx"),
  "loan documents card": dir("src/app/(app)/loans/[id]/_components/loan-documents-card.tsx"),
};

for (const [name, text] of Object.entries(lists)) {
  test(`the ${name} asks before deleting a document, in the app's own dialog`, () => {
    assert.ok(text.includes("<ConfirmDeleteDialog"), `${name}: uses the shared dialog`);
    assert.ok(!/window\.confirm|\bconfirm\(/.test(text), `${name}: never window.confirm`);
    assert.ok(text.includes("aria-label={deleteDocumentLabel(doc)}"), `${name}: the icon button has a name`);
    assert.ok(!text.includes('aria-label="Delete document"'), `${name}: no unnamed delete`);
    // The row's icon only opens the dialog; the delete runs from its Delete button.
    const handler = name === "member Documents tab" ? "handleDeleteDocument(" : "handleDelete(";
    assert.equal((text.match(new RegExp(handler.replace("(", "\\("), "g")) ?? []).length, 2, `${name}: defined once and called once`);
    const dialog = text.slice(text.indexOf("<ConfirmDeleteDialog"));
    assert.ok(dialog.slice(0, 900).includes(handler), `${name}: called from the dialog's Delete`);
  });
}

test("a valid ID row asks before deleting too, in the same dialog", () => {
  assert.ok(source.includes("aria-label={deleteValidIdLabel(entry)}"), "the icon button has a name");
  const calls = source.match(/handleDeleteValidId\(/g) ?? [];
  assert.equal(calls.length, 2, "defined once and called once");
  const dialog = source.slice(source.indexOf("<ConfirmDeleteDialog"));
  assert.ok(dialog.slice(0, 900).includes("handleDeleteValidId("), "called from the dialog's Delete");
});

test("the shared dialog is the app's AlertDialog, with Cancel and a destructive Delete", () => {
  const dialog = dir("src/components/common/confirm-delete-dialog.tsx");
  assert.ok(dialog.includes("<AlertDialog"));
  assert.ok(dialog.includes("<AlertDialogCancel"));
  assert.ok(dialog.includes('variant="destructive"'));
});
