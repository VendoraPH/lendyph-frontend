import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isBlankValidId,
  validateValidIds,
  type ValidIdDraft,
} from "./valid-id";

function draft(over: Partial<ValidIdDraft> = {}): ValidIdDraft {
  return {
    type: "",
    custom_type_name: "",
    id_number: "",
    front_file: null,
    back_file: null,
    ...over,
  };
}

// Stand-in for a picked file — the validator only ever checks for presence.
const aFile = { name: "id.png" } as unknown as File;

test("a row left completely untouched is blank", () => {
  assert.equal(isBlankValidId(draft()), true);
});

test("a row carrying an image is not blank", () => {
  assert.equal(isBlankValidId(draft({ front_file: aFile })), false);
});

test("no IDs at all is rejected", () => {
  const result = validateValidIds([]);
  assert.equal(result.ok, false);
  assert.match(result.errors[0].message, /at least one valid ID/i);
});

test("rows that are entirely blank are ignored, but cannot stand alone", () => {
  const result = validateValidIds([draft(), draft()]);
  assert.equal(result.ok, false);
  assert.match(result.errors[0].message, /at least one valid ID/i);
});

// The reported bug: front/back images uploaded, ID Type never selected and
// ID number left blank. This must not pass.
test("images uploaded with no ID type selected is rejected", () => {
  const result = validateValidIds([
    draft({ front_file: aFile, back_file: aFile }),
  ]);
  assert.equal(result.ok, false);
  const fields = result.errors.map((e) => e.field);
  assert.ok(fields.includes("type"), "expects a type error");
  assert.ok(fields.includes("id_number"), "expects an id_number error");
  assert.equal(result.errors[0].index, 0);
});

test("a blank ID number is rejected even when the type is chosen", () => {
  const result = validateValidIds([
    draft({ type: "passport", front_file: aFile }),
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((e) => e.field),
    ["id_number"]
  );
});

test("a type with no front image is rejected", () => {
  const result = validateValidIds([draft({ type: "passport", id_number: "P123" })]);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((e) => e.field),
    ["front_file"]
  );
});

test("'others' requires the custom type name", () => {
  const result = validateValidIds([
    draft({ type: "others", id_number: "X1", front_file: aFile }),
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((e) => e.field),
    ["custom_type_name"]
  );
});

test("a fully filled ID passes", () => {
  const result = validateValidIds([
    draft({ type: "passport", id_number: "P1234567", front_file: aFile }),
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

// The .some() hole: one good ID used to wave through every incomplete one
// beside it, which was then silently dropped at submit.
test("one complete ID does not excuse an incomplete one next to it", () => {
  const result = validateValidIds([
    draft({ front_file: aFile, back_file: aFile }),
    draft({ type: "passport", id_number: "P1234567", front_file: aFile }),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].index, 0);
});

test("an already uploaded row is left alone", () => {
  const result = validateValidIds([draft({ uploaded: true })]);
  assert.equal(result.ok, true);
});

// Admin member creation may leave IDs for later, but a half-filled ID is
// still a mistake worth stopping.
test("with requireAtLeastOne off, no IDs at all is fine", () => {
  const result = validateValidIds([], { requireAtLeastOne: false });
  assert.equal(result.ok, true);
});

test("with requireAtLeastOne off, an incomplete ID is still rejected", () => {
  const result = validateValidIds([draft({ front_file: aFile })], {
    requireAtLeastOne: false,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "type"));
});

test("errors are numbered for humans, per row", () => {
  const result = validateValidIds([
    draft({ type: "passport", id_number: "P1", front_file: aFile }),
    draft({ front_file: aFile }),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].index, 1);
  assert.match(result.errors[0].message, /ID 2/);
});
