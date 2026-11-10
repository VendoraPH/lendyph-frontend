import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterCreate, uploadFailureMessage, uploadMemberFiles } from "./member-uploads";

const editPage = readFileSync(
  join(process.cwd(), "src/app/(app)/borrowers/[id]/edit/page.tsx"),
  "utf8",
);
const newPage = readFileSync(join(process.cwd(), "src/app/(app)/borrowers/new/page.tsx"), "utf8");

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

test("every label on an edit page ID row is linked to its own input", () => {
  for (const field of ["type", "number", "name", "front", "back"]) {
    const id = "`valid_id_" + field + "_${index}`";
    assert.ok(editPage.includes(`htmlFor={${id}}`) || editPage.includes(`: ${id}}`), `${field} label`);
    assert.ok(editPage.includes(`id={${id}}`), `${field} input`);
  }
  for (const label of ["ID Type", "ID Number", "Front of ID", "Back of ID"]) {
    assert.ok(!editPage.includes(`<Label>${label}</Label>`), label);
  }
  assert.ok(!/<Label>\s*ID Name/.test(editPage), "ID Name");
});
