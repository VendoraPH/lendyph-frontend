import { test } from "node:test";
import assert from "node:assert/strict";
import { isRefusal, runJournalAction } from "./journal-refusal";

function httpError(status: number, message: string) {
  return { response: { status, data: { message } } };
}

test("a 409 or 422 is a refusal; other failures are not", () => {
  assert.equal(isRefusal(httpError(409, "Busy")), true);
  assert.equal(isRefusal(httpError(422, "Closed period")), true);
  assert.equal(isRefusal(httpError(500, "Server error")), false);
  assert.equal(isRefusal(httpError(403, "Forbidden")), false);
  assert.equal(isRefusal(new Error("offline")), false);
});

test("a refusal reloads the journal and returns the server's message", async () => {
  let reloads = 0;
  const message = await runJournalAction(
    () =>
      Promise.reject(
        httpError(
          422,
          "Journal entry #9 changed while it was being posted. Reload it and post it again.",
        ),
      ),
    () => reloads++,
    "Could not post this entry.",
  );
  assert.equal(reloads, 1, "the screen must not keep lines the server no longer holds");
  assert.match(message ?? "", /changed while it was being posted/);
});

test("a 409 collision reloads too", async () => {
  let reloads = 0;
  await runJournalAction(
    () => Promise.reject(httpError(409, "Someone else is posting this entry.")),
    () => reloads++,
    "Could not post this entry.",
  );
  assert.equal(reloads, 1);
});

test("a failure that isn't a refusal shows a message but doesn't reload", async () => {
  let reloads = 0;
  const message = await runJournalAction(
    () => Promise.reject(httpError(500, "")),
    () => reloads++,
    "Could not reverse this entry.",
  );
  assert.equal(reloads, 0);
  assert.ok(message);
});

test("success returns no message and doesn't reload", async () => {
  let reloads = 0;
  const message = await runJournalAction(() => Promise.resolve(), () => reloads++, "x");
  assert.equal(message, null);
  assert.equal(reloads, 0);
});
