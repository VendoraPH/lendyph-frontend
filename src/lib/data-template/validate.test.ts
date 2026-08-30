import { test } from "node:test";
import assert from "node:assert/strict";
import { addRow, createDraft, mapSheet, renameColumn, updateCell } from "./draft";
import { validateDraft } from "./validate";
import type { TemplateDraft, TemplateSheet } from "./types";

/** Fills one row of a sheet from a partial record, by column id. */
function fill(
  draft: TemplateDraft,
  sheetId: string,
  index: number,
  values: Record<string, string>
): TemplateDraft {
  return mapSheet(draft, sheetId, (sheet) =>
    Object.entries(values).reduce<TemplateSheet>(
      (acc, [columnId, value]) => updateCell(acc, index, columnId, value),
      sheet
    )
  );
}

test("an untouched draft raises nothing — a blank row is not a row missing values", () => {
  assert.deepEqual(validateDraft(createDraft()), []);
});

test("a started row is held to its required columns", () => {
  const draft = fill(createDraft(), "customer_profile", 0, {
    last_name: "Dela Cruz",
  });
  const issues = validateDraft(draft);
  assert.equal(issues.some((i) => i.columnId === "account_no"), true);
  assert.equal(issues.some((i) => i.columnId === "middle_name"), false);
});

test("the spouse block is only required once Civil Status says Married", () => {
  const single = fill(createDraft(), "customer_profile", 0, {
    civil_status: "Single",
  });
  assert.equal(
    validateDraft(single).some((i) => i.columnId === "spouse_first_name"),
    false
  );

  const married = fill(createDraft(), "customer_profile", 0, {
    civil_status: "Married",
  });
  assert.equal(
    validateDraft(married).some((i) => i.columnId === "spouse_first_name"),
    true
  );
  // Spouse middle name is yellow in the workbook — optional even when married.
  assert.equal(
    validateDraft(married).some((i) => i.columnId === "spouse_middle_name"),
    false
  );
});

test("member account numbers must be unique", () => {
  let draft = mapSheet(createDraft(), "customer_profile", addRow);
  draft = fill(draft, "customer_profile", 0, { account_no: "1001" });
  draft = fill(draft, "customer_profile", 1, { account_no: "1001" });
  assert.equal(
    validateDraft(draft).filter((i) =>
      i.message.includes("appears more than once")
    ).length,
    1
  );
});

test("a loan account with no member row is flagged", () => {
  let draft = fill(createDraft(), "customer_profile", 0, { account_no: "1001" });
  draft = fill(draft, "loans", 0, { account_no: "9999" });
  assert.equal(
    validateDraft(draft).some((i) =>
      i.message.includes("no matching row on Customer Profile")
    ),
    true
  );
});

test("duplicate loan accounts are allowed — guideline 4d", () => {
  let draft = fill(createDraft(), "customer_profile", 0, { account_no: "1001" });
  draft = mapSheet(draft, "loans", addRow);
  draft = fill(draft, "loans", 0, { account_no: "1001" });
  draft = fill(draft, "loans", 1, { account_no: "1001" });
  assert.equal(
    validateDraft(draft).some((i) => i.message.includes("more than once")),
    false
  );
});

test("a Loans sheet filled on its own is not accused of orphans", () => {
  const draft = fill(createDraft(), "loans", 0, { account_no: "9999" });
  assert.equal(
    validateDraft(draft).some((i) => i.message.includes("no matching row")),
    false
  );
});

test("two columns sharing a header is a column-level issue", () => {
  const draft = mapSheet(createDraft(), "customer_profile", (s) =>
    renameColumn(s, "last_name", "First Name")
  );
  const issues = validateDraft(draft).filter((i) => i.row === null);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /both called/);
});

test("a column left unnamed is caught", () => {
  const draft = mapSheet(createDraft(), "customer_profile", (s) =>
    renameColumn(s, "last_name", "   ")
  );
  assert.equal(
    validateDraft(draft).some((i) => i.message.includes("no header")),
    true
  );
});
