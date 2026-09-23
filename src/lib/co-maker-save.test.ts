import test from "node:test";
import assert from "node:assert/strict";

import { coMakerSaveNotice, saveCoMaker } from "./co-maker-save";

// Errors shaped the way axios throws them — getErrorMessage reads them
// structurally, so plain objects stand in exactly.
function httpError(status: number, data: Record<string, unknown> = {}) {
  return { response: { status, data } };
}
const refusedFile = httpError(422, {
  message: "The front file field must be a file of type: jpg, jpeg, png, pdf.",
  errors: { front_file: ["The front file field must be a file of type: jpg, jpeg, png, pdf."] },
});

test("a failed details save stops there — no upload is attempted", async () => {
  let uploads = 0;
  const result = await saveCoMaker(
    () => Promise.reject(httpError(422)),
    async () => {
      uploads += 1;
    }
  );
  assert.equal(result.status, "failed");
  assert.equal(uploads, 0);
});

test("a failed upload keeps the co-maker, and says which one it was", async () => {
  // The co-maker is created once. The caller gets its id so it can retry the
  // upload alone — re-running the whole save would create it a second time.
  let creates = 0;
  const result = await saveCoMaker(
    async () => {
      creates += 1;
      return 41;
    },
    () => Promise.reject(refusedFile)
  );
  assert.deepEqual(result, { status: "id_failed", coMakerId: 41, error: refusedFile });
  assert.equal(creates, 1);
});

test("the upload goes to the co-maker the first step returned", async () => {
  const uploadedFor: number[] = [];
  const result = await saveCoMaker(
    async () => 41,
    async (id) => {
      uploadedFor.push(id);
    }
  );
  assert.deepEqual(result, { status: "saved", coMakerId: 41 });
  assert.deepEqual(uploadedFor, [41]);
});

test("with no ID to upload, saving the details is the whole save", async () => {
  assert.deepEqual(await saveCoMaker(async () => 7), { status: "saved", coMakerId: 7 });
});

test("a partial add says the co-maker was added, and why the ID was not", () => {
  const notice = coMakerSaveNotice({ status: "id_failed", coMakerId: 41, error: refusedFile }, "add");
  assert.deepEqual(notice, {
    tone: "error",
    message:
      "Co-maker added, but the ID couldn't be saved: The front file field must be a file of type: jpg, jpeg, png, pdf.",
  });
});

test("a partial edit says the same of an update", () => {
  const notice = coMakerSaveNotice(
    { status: "id_failed", coMakerId: 12, error: httpError(500) },
    "update"
  );
  assert.equal(
    notice.message,
    "Co-maker updated, but the ID couldn't be saved: Something went wrong on our end. Please try again in a moment."
  );
});

test("a failed save names the field the API refused", () => {
  const notice = coMakerSaveNotice(
    {
      status: "failed",
      error: httpError(422, {
        errors: { contact_number: ["The contact number field must not be greater than 20 characters."] },
      }),
    },
    "update"
  );
  assert.deepEqual(notice, {
    tone: "error",
    message: "The contact number field must not be greater than 20 characters.",
  });
});

test("a save that never reached the server says so", () => {
  const notice = coMakerSaveNotice({ status: "failed", error: new Error("Network Error") }, "add");
  assert.match(notice.message, /offline/);
});

test("retrying just the ID reads as the ID, not as another co-maker", () => {
  assert.deepEqual(coMakerSaveNotice({ status: "saved", coMakerId: 41 }, "id"), {
    tone: "success",
    message: "ID saved",
  });
  assert.equal(
    coMakerSaveNotice({ status: "id_failed", coMakerId: 41, error: refusedFile }, "id").message,
    "The ID couldn't be saved: The front file field must be a file of type: jpg, jpeg, png, pdf."
  );
});

test("full successes read plainly", () => {
  assert.equal(coMakerSaveNotice({ status: "saved", coMakerId: 1 }, "add").message, "Co-maker added");
  assert.equal(coMakerSaveNotice({ status: "saved", coMakerId: 1 }, "update").message, "Co-maker updated");
});
