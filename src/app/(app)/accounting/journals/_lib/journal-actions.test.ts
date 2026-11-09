import { test } from "node:test";
import assert from "node:assert/strict";
import type { JournalPreview, Permission } from "@/types";
import { draftBalance, journalActions, type DraftBalance } from "./journal-actions";

const ALL: Permission[] = ["journals:create", "journals:post", "journals:reverse"];

function holding(...permissions: Permission[]) {
  return (p: Permission) => permissions.includes(p);
}

const draft = { status: "draft", reversed_by_journal_id: null } as const;
const posted = { status: "posted", reversed_by_journal_id: null } as const;
const reversed = { status: "reversed", reversed_by_journal_id: 12 } as const;

test("a draft can be edited and posted by a user holding both permissions", () => {
  const actions = journalActions(draft, holding(...ALL), { editing: false, balance: "balanced" });
  assert.deepEqual(actions.edit, { shown: true, disabledReason: null });
  assert.deepEqual(actions.post, { shown: true, disabledReason: null });
  assert.equal(actions.reverse.shown, false, "a draft has nothing to reverse");
});

test("each draft action is hidden without its own permission", () => {
  const postOnly = journalActions(draft, holding("journals:post"), { editing: false, balance: "balanced" });
  assert.equal(postOnly.edit.shown, false);
  assert.equal(postOnly.post.shown, true);

  const createOnly = journalActions(draft, holding("journals:create"), { editing: false, balance: "balanced" });
  assert.equal(createOnly.edit.shown, true);
  assert.equal(createOnly.post.shown, false);
});

test("posting waits, with a reason, while the draft is being edited", () => {
  const actions = journalActions(draft, holding(...ALL), { editing: true, balance: "balanced" });
  assert.equal(actions.post.shown, true);
  assert.match(actions.post.disabledReason ?? "", /save or cancel/i);
});

test("a posted entry can only be reversed, and only with journals:reverse", () => {
  const actions = journalActions(posted, holding(...ALL), { editing: false, balance: "balanced" });
  assert.equal(actions.edit.shown, false);
  assert.equal(actions.post.shown, false);
  assert.deepEqual(actions.reverse, { shown: true, disabledReason: null });

  const viewer = journalActions(posted, holding("journals:create", "journals:post"), {
    editing: false,
    balance: "balanced",
  });
  assert.equal(viewer.reverse.shown, false);
});

test("a posted entry that already has a reversal can't be reversed again", () => {
  const actions = journalActions(
    { status: "posted", reversed_by_journal_id: 40 },
    holding(...ALL),
    { editing: false, balance: "balanced" },
  );
  assert.equal(actions.reverse.shown, true);
  assert.match(actions.reverse.disabledReason ?? "", /already been reversed/i);
});

test("a reversed entry offers nothing", () => {
  const actions = journalActions(reversed, holding(...ALL), { editing: false, balance: "balanced" });
  assert.equal(actions.edit.shown, false);
  assert.equal(actions.post.shown, false);
  assert.equal(actions.reverse.shown, false);
});

// ── Post and the server's balance check of the stored lines ──

function postWith(balance: DraftBalance, ...permissions: Permission[]) {
  return journalActions(draft, holding(...(permissions.length ? permissions : ALL)), {
    editing: false,
    balance,
  }).post;
}

test("Post is ready only once the server says the stored lines balance", () => {
  assert.deepEqual(postWith("balanced"), { shown: true, disabledReason: null });
});

test("Post waits, with a reason, while the server says they don't balance", () => {
  assert.match(postWith("unbalanced").disabledReason ?? "", /don't balance/i);
});

test("Post waits while the balance check is still out", () => {
  assert.equal(postWith("pending").disabledReason, "Checking the totals…");
});

test("Post waits when the balance check failed", () => {
  assert.equal(postWith("failed").disabledReason, "The totals couldn't be checked");
});

test("a poster who can't ask for the preview may post: the server re-checks", () => {
  assert.equal(postWith("unknown", "journals:post").disabledReason, null);
});

test("the balance state: unknown without the preview, else the preview's answer", () => {
  const p = (over: Partial<JournalPreview> = {}): JournalPreview => ({
    total_debit: 100,
    total_credit: 100,
    difference: 0,
    out_by: 0,
    heavier_side: null,
    is_balanced: true,
    line_count: 2,
    ...over,
  });
  assert.equal(draftBalance({ canPreview: false, preview: p(), failed: null }), "unknown");
  assert.equal(draftBalance({ canPreview: true, preview: null, failed: null }), "pending");
  assert.equal(draftBalance({ canPreview: true, preview: null, failed: "x" }), "failed");
  assert.equal(draftBalance({ canPreview: true, preview: p(), failed: null }), "balanced");
  assert.equal(
    draftBalance({ canPreview: true, preview: p({ is_balanced: false }), failed: null }),
    "unbalanced",
  );
  // The server's 0 = 0 is not a balanced entry.
  assert.equal(
    draftBalance({ canPreview: true, preview: p({ total_debit: 0, total_credit: 0 }), failed: null }),
    "unbalanced",
  );
});
