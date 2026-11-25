import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CUSTOMER_COLUMNS, LOAN_COLUMNS, SHARE_CAPITAL_COLUMNS, type ImportColumn } from "@/lib/import-schema";
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

test("the members sheet keeps the workbook's colours, whatever the import refuses", () => {
  // Blue: the workbook's own required columns, and the spouse block when married.
  assert.deepEqual(
    sheet("members").columns.filter((c) => c.required).map((c) => [c.header, c.requiredWhen ?? null]),
    [
      ["Account No.", null], ["Last Name", null], ["First Name", null],
      ["Birthdate", null], ["Gender", null], ["Civil Status", null],
      ["Contact Number", null], ["email", null], ["Barangay", null],
      ["City/Municipality", null], ["Province", null],
      ["Spouse FName (If Married)", "Required when Civil Status is Married"],
      ["Spouse LName (If Married)", "Required when Civil Status is Married"],
      ["Spouse Contact No (If Married)", "Required when Civil Status is Married"],
    ]
  );
  // Painted from `required`, never from what the server refuses: a member
  // imports without a birthdate, and the column is still blue.
  const birthdate: ImportColumn | undefined = CUSTOMER_COLUMNS.find((c) => c.key === "birthdate");
  assert.equal(birthdate?.refusedWhenBlank, false);
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

test("the share capital sheet shows the import's six columns, in the import's order", () => {
  const shareCapital = sheet("share_capital");
  assert.equal(shareCapital.name, "Share Capital");
  assert.deepEqual(
    shareCapital.columns.map((c) => [c.id, c.header, c.required]),
    SHARE_CAPITAL_COLUMNS.map((c) => [c.key, c.label, c.required])
  );
  assert.match(shareCapital.description, /contribution or withdrawal/);
});

test("the share capital sheet's columns carry their hints and the transaction types", () => {
  const byId = new Map(sheet("share_capital").columns.map((c) => [c.id, c]));
  assert.equal(byId.get("account_no")?.hint, "Account No. on Members, or a member ID in Lendyph");
  assert.equal(byId.get("transaction_date")?.hint, "YYYY-MM-DD");
  assert.equal(byId.get("reference_number")?.hint, "One per transaction");
  assert.equal(byId.get("transaction_type")?.dictionary, "transaction_type");
  assert.equal(byId.get("amount")?.hint, "Above ₱0.00, 2 decimals at most");
  assert.equal(byId.get("remarks")?.hint, "The entry's description");
  assert.deepEqual(DATA_DICTIONARY.transaction_type, { label: "Transaction Type", values: ["Contribution", "Withdrawal"] });
});

test("the guidelines say what the share capital file takes", () => {
  const text = TEMPLATE_GUIDELINES.flatMap((g) => [g.text, ...(g.points ?? [])]).join("\n");
  assert.match(text, /Members, Loans and Share Capital data in separate CSV files/);
  assert.match(text, /Every Share Capital row names its member/);
  assert.doesNotMatch(text, /[Bb]orrower/);
});

test("the Documents catalog names the template's three sheets", () => {
  const catalog = readFileSync(join(process.cwd(), "src/app/(app)/printables/page.tsx"), "utf8");
  assert.match(catalog, /"The member, loan and share capital workbook for migrating an existing book onto Lendyph\."/);
  assert.doesNotMatch(catalog, /The member and loan workbook/);
});
