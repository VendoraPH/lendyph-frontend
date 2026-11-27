import assert from "node:assert/strict";
import { test } from "node:test";

import { CTX, individual, installment } from "./fixtures.test-helpers";
import { CIC_LAYOUTS } from "./layouts.generated";
import type { CicRecordInput, CicRecordValues } from "./types";
import { summarizeCicIssues, validateCicRecord, validateCsdf } from "./validate";

const run = (type: CicRecordInput["type"], values: CicRecordValues, ctx = CTX) =>
  validateCicRecord({ type, values }, ctx);
const errorsOn = (type: CicRecordInput["type"], values: CicRecordValues, ctx = CTX) =>
  run(type, values, ctx).filter((i) => i.severity === "error").map((i) => i.fieldId);
const without = (values: CicRecordValues, ...ids: string[]) =>
  Object.fromEntries(Object.entries(values).filter(([k]) => !ids.includes(k)));

test("the fixtures are valid, so every other test isolates one rule", () => {
  assert.deepEqual(errorsOn("ID", individual()), []);
  assert.deepEqual(errorsOn("CI", installment()), []);
});

// ---- §19.1 field classification

test("a missing Mandatory field blocks", () => {
  const issues = run("ID", without(individual(), "ID7"));
  assert.deepEqual(issues.map((i) => [i.fieldId, i.code, i.severity]), [["ID7", "MISSING_MANDATORY", "error"]]);
  assert.equal(summarizeCicIssues(issues).blocking, true);
});

test("missing Not Mandatory fields never produce an issue", () => {
  const nm = CIC_LAYOUTS.ID.filter((f) => f.classification === "NM").map((f) => f.id);
  assert.ok(nm.length > 30);
  assert.deepEqual(run("ID", without(individual(), ...nm)), []);
});

test("a Dependent field is not required when its condition does not apply", () => {
  // A Requested contract has no start date, end dates or payment figures yet.
  const requested = without(installment({ CI9: "RQ" }), "CI13", "CI15", "CI26", "CI28", "CI31", "CI32", "CI35");
  assert.deepEqual(errorsOn("CI", requested), []);
});

test("a Dependent field blocks once its condition applies", () => {
  const active = without(installment(), "CI13", "CI35");
  const issues = run("CI", active).filter((i) => i.severity === "error");
  assert.deepEqual(issues.map((i) => i.fieldId).sort(), ["CI13", "CI35"]);
  assert.ok(issues.every((i) => i.code === "MISSING_DEPENDENT" && /Active/.test(i.message)));
});

test("closed contracts need the actual end date and leave the outstanding figures empty", () => {
  const closed = installment({ CI9: "CL" });
  assert.deepEqual(errorsOn("CI", closed).sort(), ["CI16", "CI31", "CI32"]);
  assert.deepEqual(errorsOn("CI", without(installment({ CI9: "CL", CI16: "2026-09-30" }), "CI31", "CI32")), []);
});

test("an active contract past its planned end owes no outstanding payment count", () => {
  const overdue = without(installment({ CI15: "2026-06-30" }), "CI31", "CI32");
  assert.deepEqual(errorsOn("CI", overdue), []);
});

test("overdue figures must be empty for a requested, renounced or refused contract", () => {
  for (const phase of ["RQ", "RN", "RF"]) {
    const v = installment({ CI9: phase, CI33: 1, CI34: 500 });
    assert.deepEqual(errorsOn("CI", v).sort(), ["CI33", "CI34"], phase);
  }
});

test("type and number pairs are both filled or both empty", () => {
  assert.deepEqual(errorsOn("ID", individual({ ID56: "11" })), ["ID57"]);
  assert.deepEqual(errorsOn("ID", individual({ ID81: "x@example.test" })), ["ID80"]);
});

test("an individual needs at least one identification, and (non-MFI) one contact", () => {
  assert.deepEqual(errorsOn("ID", without(individual(), "ID54", "ID55")), ["ID54"]);
  assert.deepEqual(errorsOn("ID", without(individual(), "ID78", "ID79")), ["ID78"]);
  const mfiSubject = individual({ ID36: "SAN ROQUE", ID47: "SAN ROQUE" });
  assert.deepEqual(errorsOn("ID", without(mfiSubject, "ID78", "ID79"), { ...CTX, mfi: true }), []);
});

test("address: street is required for non-MFI, subdivision for MFI, and FullAddress replaces both", () => {
  assert.deepEqual(errorsOn("ID", without(individual(), "ID34")), ["ID34"]);
  const mfi = { ...CTX, mfi: true };
  assert.deepEqual(errorsOn("ID", individual(), mfi), ["ID36", "ID47"]);
  const full = without(individual({ ID33: "12 RIZAL ST, QUEZON CITY" }), "ID34", "ID38", "ID39");
  assert.deepEqual(errorsOn("ID", full), []);
});

test("an optional address block becomes required once any part of it is filled", () => {
  assert.deepEqual(errorsOn("ID", individual({ ID100: "PASIG" })).sort(), ["ID101", "ID94", "ID96"]);
});

test("address 2 is required for non-MFI individuals only", () => {
  const one = without(individual(), "ID43", "ID45", "ID49", "ID50");
  assert.deepEqual(errorsOn("ID", one).sort(), ["ID43", "ID45", "ID49", "ID50"]);
  assert.deepEqual(errorsOn("ID", { ...one, ID36: "SAN ROQUE" }, { ...CTX, mfi: true }), []);
});

test("guarantees: a type needs an amount, a PHP currency and a guarantor", () => {
  assert.deepEqual(errorsOn("CI", installment({ CI49: "100" })).sort(), ["CI43", "CI45"]);
  assert.deepEqual(errorsOn("CI", installment({ CI49: "100", CI45: 10000, CI44: "PEDRO" })), ["CI46"]);
  assert.deepEqual(errorsOn("CI", installment({ CI49: "100", CI45: 10000, CI44: "PEDRO", CI46: "USD" })), ["CI46"]);
  assert.deepEqual(errorsOn("CI", installment({ CI49: "100", CI45: 10000, CI43: "M-0002", CI46: "PHP" })), []);
  // The sixth block starts 70 positions later.
  assert.deepEqual(errorsOn("CI", installment({ CI119: "100" })).sort(), ["CI113", "CI115"]);
});

test("linked subjects: a role needs a subject number or a name, and both need a role", () => {
  assert.deepEqual(errorsOn("CI", installment({ CI127: "G" })), ["CI128"]);
  assert.deepEqual(errorsOn("CI", installment({ CI126: "M-0002" })), ["CI127"]);
  assert.deepEqual(errorsOn("CI", installment({ CI126: "M-0002", CI127: "G" })), []);
});

test("malformed values block even in Not Mandatory fields", () => {
  const codes = (v: CicRecordValues) => run("ID", individual(v)).map((i) => [i.fieldId, i.code]);
  assert.deepEqual(codes({ ID42: "2026-02-30" }), [["ID42", "INVALID_DATE"]]);
  assert.deepEqual(codes({ ID20: "two" }), [["ID20", "INVALID_NUMBER"]]);
  assert.deepEqual(codes({ ID19: "Z" }), [["ID19", "NOT_IN_DOMAIN"]]);
  assert.deepEqual(codes({ ID15: "x".repeat(101) }), [["ID15", "TOO_LONG"]]);
});

test("amounts with centavos are reported as information, not errors", () => {
  const issues = run("CI", installment());
  assert.ok(issues.every((i) => i.severity === "info" && i.code === "ROUNDED"));
});

test("contract dates must be in order", () => {
  assert.deepEqual(errorsOn("CI", installment({ CI15: "2026-01-01" })), ["CI15"]);
  assert.deepEqual(errorsOn("CI", installment({ CI13: "2026-11-01", CI15: "2027-11-01" })), ["CI13"]);
});

test("no record may be dated after the File Reference Date", () => {
  assert.deepEqual(errorsOn("ID", individual({ ID4: "2026-11-01" })), ["ID4"]);
});

// ---- file level

test("a file needs a valid provider code and File Reference Date", () => {
  const issues = validateCsdf([], { ...CTX, providerCode: "SHORT", fileReferenceDate: undefined });
  assert.deepEqual(issues.map((i) => i.code), ["PROVIDER_CODE", "MISSING_MANDATORY", "EMPTY_FILE"]);
});

test("a subject number is unique within a file, and contracts point at subjects in it", () => {
  const records: CicRecordInput[] = [
    { type: "ID", values: individual() },
    { type: "ID", values: individual() },
    { type: "CI", values: installment({ CI5: "M-9999" }) },
  ];
  const codes = validateCsdf(records, CTX).filter((i) => i.severity !== "info").map((i) => i.code);
  assert.deepEqual(codes, ["DUPLICATE_SUBJECT", "SUBJECT_NOT_IN_FILE"]);
});
