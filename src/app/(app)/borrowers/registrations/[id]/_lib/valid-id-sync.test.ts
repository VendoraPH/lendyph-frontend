import { test } from "node:test";
import assert from "node:assert/strict";
import type { RegistrationValidId } from "@/services/registration.service";
import type { ValidIdDraft } from "../_components/registration-valid-ids-editor";
import {
  showsIdNumberInput,
  syncValidIdDrafts,
  validIdDraftErrors,
  type ValidIdSyncDeps,
} from "./valid-id-sync";

const newFile = (name: string) => new File(["x"], name, { type: "image/png" });

function draft(over: Partial<ValidIdDraft> = {}): ValidIdDraft {
  return {
    key: "k",
    id: null,
    type: "",
    custom_type_name: "",
    id_number: "",
    stored_id_number: "",
    front_file: null,
    front_preview: null,
    front_existing_url: null,
    back_file: null,
    back_preview: null,
    back_existing_url: null,
    ...over,
  };
}

function stored(over: Partial<RegistrationValidId> = {}): RegistrationValidId {
  return {
    id: 1,
    type: "passport",
    custom_type_name: null,
    id_number: "P-1",
    front_url: "/old-front",
    back_url: "/old-back",
    created_at: "2026-11-01",
    ...over,
  } as RegistrationValidId;
}

function draftOf(item: RegistrationValidId, over: Partial<ValidIdDraft> = {}): ValidIdDraft {
  return draft({
    id: item.id,
    type: item.type,
    id_number: item.id_number ?? "",
    stored_id_number: item.id_number ?? "",
    front_existing_url: item.front_url ?? null,
    back_existing_url: item.back_url ?? null,
    ...over,
  });
}

/** Records every server call in order. `refuse` fails the uploads it names, 1-based. */
function fakeServer({ refuse = [] as number[], unreachable = [] as string[] } = {}) {
  const calls: string[] = [];
  const uploads: FormData[] = [];
  const deps: ValidIdSyncDeps = {
    prepare: async (file) => file,
    fetchExisting: async (url, filename) =>
      !url || unreachable.includes(url) ? null : newFile(filename),
    upload: async (data) => {
      uploads.push(data);
      calls.push(`upload:${data.get("id_number")}`);
      if (refuse.includes(uploads.length)) throw new Error("refused");
    },
    remove: async (id) => {
      calls.push(`delete:${id}`);
    },
  };
  return { calls, uploads, deps };
}

// ── Validation ──

test("a replacement of an ID with no number on file needs its number", () => {
  const item = stored({ id_number: null });
  const errors = validIdDraftErrors([draftOf(item, { front_file: newFile("f.png") })]);
  assert.deepEqual(errors, ["Enter the ID number for ID 1."]);
});

test("a new ID with no number is caught, numbered as the screen shows it", () => {
  const untouched = draftOf(stored({ id_number: null }));
  const errors = validIdDraftErrors([
    untouched,
    draft({ type: "passport", front_file: newFile("f.png") }),
  ]);
  assert.deepEqual(errors, ["Enter the ID number for ID 2."]);
});

test("an unchanged ID with no number on file is left alone, and a blank row is ignored", () => {
  assert.deepEqual(validIdDraftErrors([draftOf(stored({ id_number: null })), draft()]), []);
});

test("a replaced back keeps the front on file, so the front isn't asked for again", () => {
  assert.deepEqual(validIdDraftErrors([draftOf(stored(), { back_file: newFile("b.png") })]), []);
});

test("an ID that was started and left without a type or front is reported, not dropped", () => {
  const errors = validIdDraftErrors([draft({ id_number: "X-1" })]);
  assert.deepEqual(errors, ["Select an ID type for ID 1.", "Upload the front of ID 1."]);
});

test("the ID Number field shows only when a replacement needs one", () => {
  const noNumber = stored({ id_number: null });
  assert.equal(showsIdNumberInput(draftOf(noNumber)), false);
  assert.equal(showsIdNumberInput(draftOf(noNumber, { back_file: newFile("b.png") })), true);
  assert.equal(showsIdNumberInput(draftOf(stored(), { back_file: newFile("b.png") })), false);
});

// ── A replacement that changes the ID's type or number: upload first ──

test("an ID gaining its number is uploaded before the old one is deleted", async () => {
  const item = stored({ id_number: null });
  const { calls, deps } = fakeServer();
  await syncValidIdDrafts(
    [item],
    [draftOf(item, { id_number: "N-9", front_file: newFile("f.png") })],
    deps,
  );
  assert.deepEqual(calls, ["upload:N-9", "delete:1"]);
});

test("a refused upload leaves the old ID untouched", async () => {
  const item = stored({ id_number: null });
  const { calls, deps } = fakeServer({ refuse: [1] });
  await assert.rejects(
    syncValidIdDrafts(
      [item],
      [draftOf(item, { id_number: "N-9", front_file: newFile("f.png") })],
      deps,
    ),
    /refused/,
  );
  assert.deepEqual(calls, ["upload:N-9"]);
});

test("a removed ID goes only after the new ones are safely on file", async () => {
  const item = stored();
  const { calls, deps } = fakeServer({ refuse: [1] });
  const added = draft({ type: "umid", id_number: "U-1", front_file: newFile("f.png") });
  await assert.rejects(syncValidIdDrafts([item], [added], deps), /refused/);
  assert.deepEqual(calls, ["upload:U-1"]);
});

test("a removed ID is deleted once the new one is on file", async () => {
  const { calls, deps } = fakeServer();
  const added = draft({ type: "umid", id_number: "U-1", front_file: newFile("f.png") });
  await syncValidIdDrafts([stored()], [added], deps);
  assert.deepEqual(calls, ["upload:U-1", "delete:1"]);
});

// ── A replacement with the same type and number ──
// DELETE /valid-ids/{id} removes every document sharing the ID's type and number,
// so uploading first would delete the upload too.

test("the same type and number deletes first, or the delete would take the new upload", async () => {
  const item = stored();
  const { calls, uploads, deps } = fakeServer();
  const front = newFile("new.png");
  await syncValidIdDrafts([item], [draftOf(item, { front_file: front })], deps);
  assert.deepEqual(calls, ["delete:1", "upload:P-1"]);
  assert.equal(uploads.length, 1);
  assert.equal((uploads[0].get("front_file") as File).name, "new.png");
  assert.equal((uploads[0].get("back_file") as File).name, "back.jpg");
});

test("a refused replacement puts the old ID back and still reports the refusal", async () => {
  const item = stored();
  const { calls, uploads, deps } = fakeServer({ refuse: [1] });
  await assert.rejects(
    syncValidIdDrafts([item], [draftOf(item, { front_file: newFile("new.png") })], deps),
    /refused/,
  );
  assert.deepEqual(calls, ["delete:1", "upload:P-1", "upload:P-1"]);
  assert.equal((uploads[1].get("front_file") as File).name, "front.jpg");
  assert.equal((uploads[1].get("back_file") as File).name, "back.jpg");
  assert.equal(uploads[1].get("type"), "passport");
});

test("nothing is deleted when the old ID can't be copied first", async () => {
  const item = stored();
  const { calls, deps } = fakeServer({ unreachable: ["/old-front"] });
  await assert.rejects(
    syncValidIdDrafts([item], [draftOf(item, { front_file: newFile("new.png") })], deps),
    /nothing was changed/i,
  );
  assert.deepEqual(calls, []);
});

test("if the old ID can't be put back either, the message says it is gone", async () => {
  const item = stored();
  const { deps } = fakeServer({ refuse: [1, 2] });
  await assert.rejects(
    syncValidIdDrafts([item], [draftOf(item, { front_file: newFile("new.png") })], deps),
    /removed.*upload it again/i,
  );
});

test("a new row with the type and number of a removed ID counts as replacing it", async () => {
  const item = stored();
  const { calls, deps } = fakeServer({ refuse: [1] });
  const added = draft({ type: "passport", id_number: "p-1", front_file: newFile("f.png") });
  await assert.rejects(syncValidIdDrafts([item], [added], deps), /refused/);
  assert.deepEqual(calls, ["delete:1", "upload:p-1", "upload:P-1"]);
});

test("an unchanged ID makes no call, and a kept ID isn't deleted", async () => {
  const item = stored();
  const { calls, deps } = fakeServer();
  await syncValidIdDrafts([item], [draftOf(item), draft()], deps);
  assert.deepEqual(calls, []);
});
