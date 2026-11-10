import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterCreate, isUploadRefused, uploadFailureMessage, uploadMemberFiles } from "./member-uploads";

const editPage = readFileSync(
  join(process.cwd(), "src/app/(app)/borrowers/[id]/edit/page.tsx"),
  "utf8",
);
const newPage = readFileSync(join(process.cwd(), "src/app/(app)/borrowers/new/page.tsx"), "utf8");

function refused(data: unknown) {
  return { isAxiosError: true, response: { status: 422, data } };
}

/** No reply at all: a timeout (or a dropped connection). The server may have stored it. */
const timedOut = { isAxiosError: true, code: "ECONNABORTED", message: "timeout of 60000ms exceeded" };
const serverError = { isAxiosError: true, response: { status: 500, data: { message: "Server Error" } } };

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

test("after a create, the toast says the member was saved and where to add the file again", () => {
  const err = refused({ errors: { photo: ["The photo must be a JPG or PNG image."] } });
  assert.deepEqual(
    uploadFailureMessage("photo", err, { saved: "Member saved", hint: "Add it again on this page." }),
    {
      title: "Member saved, but the photo upload failed",
      description: "The photo must be a JPG or PNG image. Add it again on this page.",
    },
  );
});

test("after a create, a failed upload goes to the member's edit page when the user may edit", () => {
  const can = (held: string[]) => (permission: string) => held.includes(permission);
  assert.deepEqual(afterCreate(12, false, can(["borrowers:update", "borrowers:view"])), {
    path: "/borrowers",
    retryHere: false,
  });
  assert.deepEqual(afterCreate(12, true, can(["borrowers:update", "borrowers:view"])), {
    path: "/borrowers/12/edit",
    retryHere: true,
  });
  // Without update the edit page would refuse them: the member's page instead.
  assert.deepEqual(afterCreate(12, true, can(["borrowers:view"])), { path: "/borrowers/12", retryHere: false });
  assert.deepEqual(afterCreate(12, true, can([])), { path: "/borrowers", retryHere: false });
});

test("the new member page reports failed uploads in words and never stays to create twice", () => {
  assert.ok(newPage.includes("uploadMemberFiles("), "uses the helper");
  assert.ok(newPage.includes("afterCreate("), "decides where to go with the helper");
  assert.ok(!newPage.includes("Member created but photo upload failed"), "no generic photo message");
  assert.ok(!newPage.includes("ID. Please try again."), "no generic ID message");
  assert.ok(newPage.includes('saved: "Member saved"'), "says the member was saved");
});

test("a failure the server didn't explain still asks to try again", () => {
  // (An ID with no server answer is uncertain instead; see the test below.)
  assert.equal(uploadFailureMessage("photo", new Error("boom")).description, "Please try again.");
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
  assert.deepEqual(result.failedIds, [{ entry: ids[1], error: bad, refused: true }]);
  assert.equal(result.anyFailed, true);
});

test("only a refusal (4xx) is kept for a retry; an upload with no reply or a 5xx may be stored", () => {
  assert.equal(isUploadRefused(refused({ message: "Too large." })), true);
  assert.equal(isUploadRefused({ isAxiosError: true, response: { status: 403, data: {} } }), true);
  assert.equal(isUploadRefused(timedOut), false);
  assert.equal(isUploadRefused(serverError), false);
  assert.equal(isUploadRefused(new Error("boom")), false);
});

test("an upload that timed out is reported as uncertain and is never kept for a retry", async () => {
  const ids = [{ n: "A" }, { n: "B" }];
  const result = await uploadMemberFiles({
    photo: null,
    ids,
    uploadPhoto: async () => undefined,
    uploadId: async (entry) => {
      throw entry.n === "A" ? timedOut : refused({ message: "Too large." });
    },
  });
  assert.deepEqual(
    result.failedIds.map((f) => [f.entry.n, f.refused]),
    [["A", false], ["B", true]],
  );
});

test("an uncertain ID upload asks to check the list before adding it again", () => {
  assert.deepEqual(uploadFailureMessage("ID", timedOut), {
    title: "The ID may not have uploaded. Check the list below before adding it again.",
    description: "Member details saved.",
  });
  assert.deepEqual(
    uploadFailureMessage("ID", serverError, {
      saved: "Member saved",
      hint: "Add it again on this page.",
      uncertainHint: "Check the member's Documents tab before adding it again.",
    }),
    {
      title: "The ID may not have uploaded. Check the member's Documents tab before adding it again.",
      description: "Member saved.",
    },
  );
  // A photo replaces the last one, so a retry can't store it twice: the usual message.
  assert.equal(uploadFailureMessage("photo", timedOut).title, "Member details saved, but the photo upload failed");
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

test("after a failed upload the edit page reloads the IDs on file and keeps only refused IDs", () => {
  assert.ok(editPage.includes("useMemberValidIds(borrowerId)"), "loads the IDs on file");
  assert.ok(editPage.includes("<MemberValidIdsOnFile"), "shows them");
  assert.ok(
    editPage.includes("setValidIds(uploads.failedIds.filter((failed) => failed.refused).map((failed) => failed.entry));"),
    "keeps only refusals",
  );
  const failedBranch = editPage.slice(editPage.indexOf("if (uploads.anyFailed) {"));
  assert.ok(failedBranch.slice(0, 200).includes("idsOnFile.reload();"), "reloads on a failure");
});

for (const [name, page] of [["edit", editPage], ["new", newPage]] as const) {
  test(`every label on a ${name} member page ID row is linked to its own input`, () => {
    for (const field of ["type", "number", "name", "front", "back"]) {
      const id = "`valid_id_" + field + "_${index}`";
      assert.ok(page.includes(`htmlFor={${id}}`) || page.includes(`: ${id}}`), `${field} label`);
      // Front and back point at the keyboard picker (ValidIdFilePicker), which carries the id.
      const control = field === "front" || field === "back" ? `controlId={${id}}` : `id={${id}}`;
      assert.ok(page.includes(control), `${field} input`);
    }
    for (const label of ["ID Type", "ID Number", "Front of ID", "Back of ID"]) {
      assert.ok(!page.includes(`<Label>${label}</Label>`), label);
    }
    assert.ok(!/<Label>\s*ID Name/.test(page), "ID Name");
  });
}
