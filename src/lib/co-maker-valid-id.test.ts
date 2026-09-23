import test from "node:test";
import assert from "node:assert/strict";

import {
  VALID_ID_MAX_BYTES,
  checkCoMakerId,
  coMakerIdFormData,
  emptyCoMakerIdDraft,
  idFileProblem,
  isBlankCoMakerId,
  validIdTypeLabel,
  type CoMakerIdDraft,
  type ReadyCoMakerId,
} from "./co-maker-valid-id";

// Real Files, so FormData carries them exactly as the browser would.
function aFile(name: string, type: string, size = 2048): File {
  return new File([new Uint8Array(size)], name, { type });
}
const jpg = aFile("philsys-front.jpg", "image/jpeg");

function draft(over: Partial<CoMakerIdDraft> = {}): CoMakerIdDraft {
  return { ...emptyCoMakerIdDraft(), ...over };
}

type OnFile = Parameters<typeof checkCoMakerId>[1];

function ready(d: CoMakerIdDraft, onFile: OnFile = []): ReadyCoMakerId {
  const check = checkCoMakerId(d, onFile);
  if (check.status !== "ready") assert.fail(`expected a ready ID, got ${JSON.stringify(check)}`);
  return check.id;
}

test("leaving the ID empty is allowed, and uploads nothing", () => {
  assert.equal(isBlankCoMakerId(emptyCoMakerIdDraft()), true);
  assert.deepEqual(checkCoMakerId(emptyCoMakerIdDraft()), { status: "none" });
});

test("a photo needs its type", () => {
  const check = checkCoMakerId(draft({ file: jpg }));
  assert.equal(check.status, "invalid");
  assert.deepEqual(Object.keys(check.status === "invalid" ? check.errors : {}), ["type"]);
});

test("a type with no photo can't be stored, so it is refused rather than dropped", () => {
  // The API requires a file on every upload. The old dialog kept the type and
  // number in the form, sent them nowhere, and said "Co-maker added".
  const check = checkCoMakerId(draft({ type: "passport" }));
  assert.equal(check.status, "invalid");
  if (check.status === "invalid") {
    assert.deepEqual(Object.keys(check.errors), ["file"]);
    assert.match(check.errors.file!, /photo of the ID/);
  }
});

test("an ID number on its own can't be stored either", () => {
  const check = checkCoMakerId(draft({ id_number: "P1234567A" }));
  assert.equal(check.status, "invalid");
  if (check.status === "invalid") {
    assert.deepEqual(Object.keys(check.errors).sort(), ["file", "type"]);
  }
});

test("a type and a photo are enough — the ID number is optional", () => {
  // The API's rule for id_number is nullable. (The member forms ask for it;
  // nothing here requires it.)
  const id = ready(draft({ type: "philippine_id", file: jpg }));
  assert.equal(id.file, jpg);
});

test("'Others' needs the ID named", () => {
  const unnamed = checkCoMakerId(draft({ type: "others", file: jpg }));
  assert.equal(unnamed.status, "invalid");
  if (unnamed.status === "invalid") assert.deepEqual(Object.keys(unnamed.errors), ["custom_type_name"]);

  ready(draft({ type: "others", custom_type_name: "Company ID", file: jpg }));
});

test("only JPG, PNG and PDF are accepted, as the API's mimes rule says", () => {
  assert.equal(idFileProblem(jpg), null);
  assert.equal(idFileProblem(aFile("id.png", "image/png")), null);
  assert.equal(idFileProblem(aFile("id.pdf", "application/pdf")), null);

  // Both pass a generic "image" check and are refused by the server.
  for (const refused of [aFile("id.heic", "image/heic"), aFile("id.webp", "image/webp")]) {
    assert.match(idFileProblem(refused) ?? "", /Please use JPG, PNG, PDF/, refused.name);
  }
});

test("a file over 10 MB is refused, and the message names the real limit", () => {
  assert.equal(idFileProblem(aFile("scan.pdf", "application/pdf", VALID_ID_MAX_BYTES)), null);
  const tooBig = aFile("scan.pdf", "application/pdf", VALID_ID_MAX_BYTES + 1);
  // The shared helper used to say "max 5MB" whatever limit it was given.
  assert.equal(idFileProblem(tooBig), "File is too large (max 10MB).");

  const check = checkCoMakerId(draft({ type: "passport", file: tooBig }));
  assert.equal(check.status, "invalid");
  if (check.status === "invalid") assert.equal(check.errors.file, "File is too large (max 10MB).");
});

test("the same ID twice is refused — the API would merge the two", () => {
  // Listed and deleted by (type, number): a second upload would hide behind
  // the first, and removing either would remove both.
  const onFile = [{ type: "philippine_id", id_number: "abc-1234" }];

  const same = checkCoMakerId(draft({ type: "philippine_id", id_number: " ABC-1234 ", file: jpg }), onFile);
  assert.equal(same.status, "invalid");
  if (same.status === "invalid") assert.match(same.errors.id_number ?? "", /already on file/);

  ready(draft({ type: "philippine_id", id_number: "XYZ-9999", file: jpg }), onFile);
  ready(draft({ type: "passport", id_number: "abc-1234", file: jpg }), onFile);
});

test("someone who can't remove IDs isn't told to remove one", () => {
  // Uploading needs borrowers:update, removing needs borrowers:delete — a loan
  // officer has the first and not the second, so "remove it first" would point
  // at a button they don't have.
  const onFile = [{ type: "passport", id_number: "P1234567A" }];
  const check = checkCoMakerId(draft({ type: "passport", id_number: "P1234567A", file: jpg }), onFile, {
    canRemove: false,
  });
  assert.equal(check.status, "invalid");
  if (check.status === "invalid") {
    assert.equal(
      check.errors.id_number,
      "This ID is already on file. Replacing its photo means removing it first, which your role can't do."
    );
  }
});

test("a blank number matches an ID on file that has none", () => {
  const onFile = [{ type: "sss", id_number: null }];
  assert.equal(checkCoMakerId(draft({ type: "sss", file: jpg }), onFile).status, "invalid");
});

test("when the ID is all that is left to save, a blank draft is a mistake", () => {
  const check = checkCoMakerId(emptyCoMakerIdDraft(), [], { required: true });
  assert.equal(check.status, "invalid");
  if (check.status === "invalid") assert.deepEqual(Object.keys(check.errors).sort(), ["file", "type"]);
});

test("the upload carries the borrower endpoint's fields, and the photo as front_file", () => {
  const body = coMakerIdFormData(
    ready(draft({ type: "philippine_id", id_number: "  1234-5678-9012 ", file: jpg }))
  );

  assert.deepEqual([...body.keys()], ["type", "id_number", "front_file"]);
  assert.equal(body.get("type"), "philippine_id");
  assert.equal(body.get("id_number"), "1234-5678-9012");
  const sent = body.get("front_file");
  assert.ok(sent instanceof File);
  assert.equal(sent.name, "philsys-front.jpg");
  // Never the legacy single `file` too: the API refuses a request with both.
  assert.equal(body.has("file"), false);
  // And never a back side on its own — the API refuses a back-only upload.
  assert.equal(body.has("back_file"), false);
});

test("a blank ID number is left out rather than sent empty", () => {
  const body = coMakerIdFormData(ready(draft({ type: "drivers_license", id_number: "   ", file: jpg })));
  assert.deepEqual([...body.keys()], ["type", "front_file"]);
});

test("the custom name rides along with 'Others' only", () => {
  const others = coMakerIdFormData(
    ready(draft({ type: "others", custom_type_name: "  Company ID ", file: jpg }))
  );
  assert.equal(others.get("custom_type_name"), "Company ID");

  // Typed while "Others" was picked, then the type changed: not sent.
  const passport = coMakerIdFormData(
    ready(draft({ type: "passport", custom_type_name: "Company ID", file: jpg }))
  );
  assert.equal(passport.has("custom_type_name"), false);
});

test("an ID type reads as its label, or the name given for 'Others'", () => {
  assert.equal(validIdTypeLabel("philippine_id"), "Philippine National ID (PhilSys)");
  assert.equal(validIdTypeLabel("others", "Company ID"), "Company ID");
  assert.equal(validIdTypeLabel("others", null), "Others");
  assert.equal(validIdTypeLabel("barangay_id"), "barangay_id");
});
