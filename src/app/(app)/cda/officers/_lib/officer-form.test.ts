import { test } from "node:test";
import assert from "node:assert/strict";
import { officerInput, officerMissing } from "./officer-form";

const draft = { position: "treasurer", term_start: "2026-01-01", status: "active", name: "Ana Cruz", sex: "female" };

test("a linked officer sends the member and no name or sex of their own", () => {
  const body = officerInput(draft, 12);
  assert.equal(body.borrower_id, 12);
  assert.equal(body.name, null);
  assert.equal(body.sex, null);
  assert.equal(body.position, "treasurer");
});

test("an unlinked officer keeps their own name and sex, which are then required", () => {
  const body = officerInput(draft, null);
  assert.equal(body.borrower_id, null);
  assert.equal(body.name, "Ana Cruz");
  assert.equal(body.sex, "female");
  assert.deepEqual(officerMissing({ ...draft, name: "", sex: "" }, false), ["Name", "Sex"]);
  assert.deepEqual(officerMissing({ ...draft, name: "", sex: "" }, true), []);
});
