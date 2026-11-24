import { test } from "node:test";
import assert from "node:assert/strict";
import { CUSTOMER_COLUMNS, LOAN_COLUMNS } from "@/lib/import-schema";
import { DATA_DICTIONARY, TEMPLATE_GUIDELINES, TEMPLATE_SHEETS } from "./template";

function sheet(id: string) {
  const found = TEMPLATE_SHEETS.find((s) => s.id === id);
  assert.ok(found, `no ${id} sheet`);
  return found;
}

test("the members sheet is called Members and shows the import's 26 columns, in the import's order", () => {
  const members = sheet("members");
  assert.equal(members.name, "Members");
  assert.equal(members.columns.length, 26);
  assert.deepEqual(
    members.columns.map((c) => c.id),
    CUSTOMER_COLUMNS.map((c) => c.key)
  );
  assert.deepEqual(
    members.columns.map((c) => c.header),
    CUSTOMER_COLUMNS.map((c) => c.label)
  );
});

test("the members sheet's required flags follow the import, spouse columns only when married", () => {
  const members = sheet("members");
  for (const [index, source] of CUSTOMER_COLUMNS.entries()) {
    const column = members.columns[index];
    const conditional = "requiredWhen" in source;
    assert.equal(column.required, source.required || conditional, source.key);
    assert.equal(Boolean(column.requiredWhen), conditional, source.key);
  }
});

test("the members sheet's closed lists and dates carry their dictionary and format", () => {
  const byId = new Map(sheet("members").columns.map((c) => [c.id, c]));
  assert.equal(byId.get("gender")?.dictionary, "gender");
  assert.equal(byId.get("civil_status")?.dictionary, "civil_status");
  assert.equal(byId.get("suffix")?.dictionary, "suffix");
  assert.equal(byId.get("member_type")?.dictionary, "member_type");
  assert.deepEqual(DATA_DICTIONARY.member_type.values, ["Regular", "Associate"]);
  for (const id of ["birthdate", "date_hired", "membership_date"]) {
    assert.equal(byId.get(id)?.hint, "YYYY-MM-DD", id);
  }
  assert.equal(byId.get("member_type")?.hint, "Blank means Regular");
});

test("the loans sheet is unchanged", () => {
  const loans = sheet("loans");
  assert.equal(loans.name, "Loans");
  assert.deepEqual(
    loans.columns.map((c) => c.header),
    LOAN_COLUMNS.map((c) => c.label)
  );
});

test("the sheet descriptions and guidelines call the members file Members", () => {
  const text = [
    ...TEMPLATE_SHEETS.map((s) => s.description),
    ...TEMPLATE_GUIDELINES.flatMap((g) => [g.text, ...(g.points ?? [])]),
  ].join("\n");
  assert.doesNotMatch(text, /Customer Profile/);
});
