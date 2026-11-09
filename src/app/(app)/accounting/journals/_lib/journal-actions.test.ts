import { test } from "node:test";
import assert from "node:assert/strict";
import type { Permission } from "@/types";
import { journalActions } from "./journal-actions";

const ALL: Permission[] = ["journals:create", "journals:post", "journals:reverse"];

function holding(...permissions: Permission[]) {
  return (p: Permission) => permissions.includes(p);
}

const draft = { status: "draft", reversed_by_journal_id: null } as const;
const posted = { status: "posted", reversed_by_journal_id: null } as const;
const reversed = { status: "reversed", reversed_by_journal_id: 12 } as const;

test("a draft can be edited and posted by a user holding both permissions", () => {
  const actions = journalActions(draft, holding(...ALL), { editing: false });
  assert.deepEqual(actions.edit, { shown: true, disabledReason: null });
  assert.deepEqual(actions.post, { shown: true, disabledReason: null });
  assert.equal(actions.reverse.shown, false, "a draft has nothing to reverse");
});

test("each draft action is hidden without its own permission", () => {
  const postOnly = journalActions(draft, holding("journals:post"), { editing: false });
  assert.equal(postOnly.edit.shown, false);
  assert.equal(postOnly.post.shown, true);

  const createOnly = journalActions(draft, holding("journals:create"), { editing: false });
  assert.equal(createOnly.edit.shown, true);
  assert.equal(createOnly.post.shown, false);
});

test("posting waits, with a reason, while the draft is being edited", () => {
  const actions = journalActions(draft, holding(...ALL), { editing: true });
  assert.equal(actions.post.shown, true);
  assert.match(actions.post.disabledReason ?? "", /save or cancel/i);
});

test("a posted entry can only be reversed, and only with journals:reverse", () => {
  const actions = journalActions(posted, holding(...ALL), { editing: false });
  assert.equal(actions.edit.shown, false);
  assert.equal(actions.post.shown, false);
  assert.deepEqual(actions.reverse, { shown: true, disabledReason: null });

  const viewer = journalActions(posted, holding("journals:create", "journals:post"), {
    editing: false,
  });
  assert.equal(viewer.reverse.shown, false);
});

test("a posted entry that already has a reversal can't be reversed again", () => {
  const actions = journalActions(
    { status: "posted", reversed_by_journal_id: 40 },
    holding(...ALL),
    { editing: false },
  );
  assert.equal(actions.reverse.shown, true);
  assert.match(actions.reverse.disabledReason ?? "", /already been reversed/i);
});

test("a reversed entry offers nothing", () => {
  const actions = journalActions(reversed, holding(...ALL), { editing: false });
  assert.equal(actions.edit.shown, false);
  assert.equal(actions.post.shown, false);
  assert.equal(actions.reverse.shown, false);
});

test("posting a draft waits, with a reason, while the server says it doesn't balance", () => {
  const unbalanced = journalActions(draft, holding(...ALL), { editing: false, balanced: false });
  assert.equal(unbalanced.post.shown, true);
  assert.match(unbalanced.post.disabledReason ?? "", /don't balance/i);

  const ready = journalActions(draft, holding(...ALL), { editing: false, balanced: true });
  assert.equal(ready.post.disabledReason, null);
});

test("when the balance can't be checked, the server decides on posting", () => {
  // A poster without journals:create can't ask for the preview.
  const unknown = journalActions(draft, holding("journals:post"), {
    editing: false,
    balanced: null,
  });
  assert.equal(unknown.post.disabledReason, null);
});
