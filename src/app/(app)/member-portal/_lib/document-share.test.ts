import { test } from "node:test";
import assert from "node:assert/strict";
import { sharedFromList } from "./document-share";

// lendyph-backend P4 sends `portal_shared_at` on staff documents (a Manila ISO
// time or null) to staff who can share; older backends leave it out.
test("a file the list says is shared offers only Stop sharing; one it says isn't, only Share", () => {
  assert.equal(sharedFromList({ id: 1, portal_shared_at: "2026-11-10T10:15:00+08:00" }), true);
  assert.equal(sharedFromList({ id: 1, portal_shared_at: null }), false);
});

test("without the field the state is unknown, so both actions are offered", () => {
  assert.equal(sharedFromList({ id: 1 }), undefined);
});
