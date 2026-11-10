import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { uploadFailureMessage, uploadMemberFiles } from "./member-uploads";

const editPage = readFileSync(
  join(process.cwd(), "src/app/(app)/borrowers/[id]/edit/page.tsx"),
  "utf8",
);

function refused(data: unknown) {
  return { isAxiosError: true, response: { status: 422, data } };
}

test("a refused photo says the details were saved, then the server's field message", () => {
  const err = refused({
    message: "The given data was invalid.",
    errors: { photo: ["The photo must be a JPG or PNG image."] },
  });
  assert.deepEqual(uploadFailureMessage("photo", err), {
    title: "Member details saved, but the photo upload failed",
    description: "The photo must be a JPG or PNG image.",
  });
});

test("with no field message, the server's message is used", () => {
  assert.deepEqual(uploadFailureMessage("ID", refused({ message: "This ID image could not be read." })), {
    title: "Member details saved, but the ID upload failed",
    description: "This ID image could not be read.",
  });
});

test("a failure the server didn't explain still asks to try again", () => {
  assert.equal(uploadFailureMessage("ID", new Error("boom")).description, "Please try again.");
});

test("uploads report what failed and keep only the IDs that weren't saved", async () => {
  const ids = [{ n: "A" }, { n: "B" }, { n: "C" }];
  const bad = refused({ message: "Too large." });
  const sent: string[] = [];
  const result = await uploadMemberFiles({
    photo: "photo-file",
    ids,
    uploadPhoto: async () => {
      sent.push("photo");
    },
    uploadId: async (entry) => {
      sent.push(entry.n);
      if (entry.n === "B") throw bad;
    },
  });
  assert.deepEqual(sent, ["photo", "A", "B", "C"]);
  assert.equal(result.photoError, null);
  assert.deepEqual(result.failedIds, [{ entry: ids[1], error: bad }]);
  assert.equal(result.anyFailed, true);
});

test("a failed photo is reported and the IDs still go", async () => {
  const bad = refused({ errors: { photo: ["Bad photo."] } });
  const result = await uploadMemberFiles({
    photo: "photo-file",
    ids: [{ n: "A" }],
    uploadPhoto: async () => {
      throw bad;
    },
    uploadId: async () => undefined,
  });
  assert.equal(result.photoError, bad);
  assert.deepEqual(result.failedIds, []);
  assert.equal(result.anyFailed, true);
});

test("no photo and no IDs is nothing to upload", async () => {
  const result = await uploadMemberFiles({
    photo: null,
    ids: [],
    uploadPhoto: async () => {
      throw new Error("not called");
    },
    uploadId: async () => undefined,
  });
  assert.deepEqual(result, { photoError: null, failedIds: [], anyFailed: false });
});

test("the edit page stays on the page when an upload failed, and leaves only when all went", () => {
  assert.ok(editPage.includes("uploadMemberFiles("), "uses the helper");
  assert.ok(!editPage.includes("Member updated but photo upload failed"), "no generic photo message");
  const failedBranch = editPage.indexOf("if (uploads.anyFailed)");
  const success = editPage.indexOf('toast.success("Member updated")');
  const leave = editPage.indexOf("router.push(`/borrowers/${borrowerId}`)");
  assert.ok(failedBranch !== -1 && failedBranch < success && success < leave, "the failed branch returns first");
  assert.ok(/if \(uploads\.anyFailed\) \{[^}]*return;/.test(editPage), "the failed branch returns before leaving");
});

test("the ID Number label is linked to its input", () => {
  assert.ok(editPage.includes("<Label htmlFor={`valid_id_number_${index}`}>ID Number</Label>"));
  assert.ok(editPage.includes("id={`valid_id_number_${index}`}"));
});
