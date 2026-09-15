import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addColumn,
  addRow,
  createDraft,
  filledRows,
  findSheet,
  mapSheet,
  moveColumn,
  removeColumn,
  removeRow,
  renameColumn,
  setColumnRequired,
  updateCell,
} from "./draft";
import { renderSheetCsv } from "./export";
import type { TemplateSheet } from "./types";

function profiles(): TemplateSheet {
  const sheet = findSheet(createDraft(), "customer_profile");
  assert.ok(sheet);
  return sheet;
}

test("a fresh draft carries both sheets, each with one row to type into", () => {
  const draft = createDraft();
  assert.deepEqual(
    draft.sheets.map((s) => s.id),
    ["customer_profile", "loans"]
  );
  assert.equal(draft.sheets[0].columns.length, 22);
  assert.equal(draft.sheets[1].columns.length, 18);
  for (const sheet of draft.sheets) assert.equal(sheet.rows.length, 1);
});

test("editing a draft never mutates the template it was built from", () => {
  const first = createDraft();
  renameColumn(first.sheets[0], "account_no", "Member No.");
  const second = createDraft();
  assert.equal(second.sheets[0].columns[0].header, "Account No.");
});

test("renaming a column keeps the data typed under it", () => {
  let sheet = updateCell(profiles(), 0, "last_name", "Dela Cruz");
  sheet = renameColumn(sheet, "last_name", "Surname");
  assert.equal(sheet.rows[0].last_name, "Dela Cruz");
  assert.equal(sheet.columns[1].header, "Surname");
});

test("removing a column takes its data with it", () => {
  let sheet = updateCell(profiles(), 0, "middle_name", "Reyes");
  sheet = removeColumn(sheet, "middle_name");
  assert.equal(sheet.columns.some((c) => c.id === "middle_name"), false);
  assert.equal("middle_name" in sheet.rows[0], false);
});

test("a new column lands after the one it was added from, blank on every row", () => {
  let sheet = addRow(profiles());
  sheet = addColumn(sheet, "account_no");
  assert.equal(sheet.columns[1].header, "New column");
  assert.equal(sheet.columns[1].required, false);
  for (const row of sheet.rows) assert.equal(row[sheet.columns[1].id], "");
});

test("a new column id never collides with one already in the sheet", () => {
  let sheet = addColumn(profiles());
  const first = sheet.columns[sheet.columns.length - 1].id;
  sheet = addColumn(sheet);
  const second = sheet.columns[sheet.columns.length - 1].id;
  assert.notEqual(first, second);
});

test("moving a column is a no-op at either end", () => {
  const sheet = profiles();
  assert.deepEqual(moveColumn(sheet, "account_no", "left").columns, sheet.columns);
  const last = sheet.columns[sheet.columns.length - 1].id;
  assert.deepEqual(moveColumn(sheet, last, "right").columns, sheet.columns);
});

test("moving a column right swaps it with its neighbour", () => {
  const sheet = moveColumn(profiles(), "account_no", "right");
  assert.deepEqual(
    sheet.columns.slice(0, 2).map((c) => c.id),
    ["last_name", "account_no"]
  );
});

test("required can be toggled both ways", () => {
  let sheet = setColumnRequired(profiles(), "account_no", false);
  assert.equal(sheet.columns[0].required, false);
  sheet = setColumnRequired(sheet, "middle_name", true);
  assert.equal(sheet.columns[3].required, true);
});

test("rows can be added and removed by index", () => {
  let sheet = addRow(addRow(profiles()));
  sheet = updateCell(sheet, 1, "account_no", "1002");
  sheet = removeRow(sheet, 0);
  assert.equal(sheet.rows.length, 2);
  assert.equal(sheet.rows[0].account_no, "1002");
});

test("a row nobody typed into is not exported", () => {
  let sheet = addRow(profiles());
  sheet = updateCell(sheet, 0, "account_no", "1001");
  assert.equal(filledRows(sheet).length, 1);
});

test("the CSV keeps the header row and follows the edited column order", () => {
  let draft = createDraft();
  draft = mapSheet(draft, "customer_profile", (s) =>
    moveColumn(updateCell(s, 0, "account_no", "1001"), "account_no", "right")
  );
  const csv = renderSheetCsv(draft.sheets[0]);
  const [header, first] = csv.split("\r\n");
  assert.equal(header.startsWith("Last Name,Account No.,"), true);
  assert.equal(first.startsWith(",1001,"), true);
});

test("a header containing a comma is quoted on the way out", () => {
  const sheet = renameColumn(profiles(), "account_no", "Account, No.");
  assert.equal(renderSheetCsv(sheet).startsWith('"Account, No.",'), true);
});

test("an untouched draft exports the bare header row", () => {
  assert.equal(renderSheetCsv(profiles()).includes("\r\n"), false);
});
