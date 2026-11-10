import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { JournalPreview, Permission } from "@/types";
import type { JournalValidation } from "@/lib/accounting/journal";
import {
  draftBalance,
  journalActions,
  journalPageDescription,
  reversedEntryText,
  saveDraftState,
  type DraftBalance,
} from "./journal-actions";

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

test("an entry that is itself a reversal doesn't offer Reverse", () => {
  const reversal = { status: "posted", reversed_by_journal_id: null, reverses_journal_id: 38 } as const;
  const actions = journalActions(reversal, holding(...ALL), { editing: false, balance: "balanced" });
  assert.equal(actions.reverse.shown, false);
  assert.equal(actions.edit.shown, false);
  assert.equal(actions.post.shown, false);
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

test("a year-end closing entry offers Reverse disabled: reopening the year undoes it", () => {
  const actions = journalActions(
    { status: "posted", source: "closing", date: "2025-12-31", reversed_by_journal_id: null },
    holding(...ALL),
    { editing: false, balance: "balanced" },
  );
  assert.equal(actions.reverse.shown, true);
  assert.equal(
    actions.reverse.disabledReason,
    "This entry is part of the 2025 year-end close. Reopen the year instead.",
  );
});

test("the reversal of a closing entry (a reopen) doesn't offer Reverse", () => {
  const actions = journalActions(
    { status: "posted", source: "reversal", date: "2025-12-31", reversed_by_journal_id: null, reverses_journal_id: 50 },
    holding(...ALL),
    { editing: false, balance: "balanced" },
  );
  assert.equal(actions.reverse.shown, false);
});

// ── Save draft ──

const READY_TO_SAVE: JournalValidation = { ok: true, errors: [] };

test("Save draft is offered and ready once the entry could be saved", () => {
  assert.deepEqual(saveDraftState(READY_TO_SAVE, { isTemplate: false }), {
    shown: true,
    disabledReason: null,
  });
});

test("Save draft is disabled with the first problem as its reason, never a toast", () => {
  const state = saveDraftState(
    {
      ok: false,
      errors: [
        { index: 0, field: "account", message: "Select an account for Line 1." },
        { index: 1, field: "amount", message: "Enter a debit or a credit for Line 2." },
      ],
    },
    { isTemplate: false },
  );
  assert.equal(state.shown, true);
  assert.equal(state.disabledReason, "Select an account for Line 1. (1 more to fix)");
});

test("an entry-wide problem reads as it is", () => {
  const state = saveDraftState(
    {
      ok: false,
      errors: [{ index: null, field: "balance", message: "The totals are still being checked. Try again in a moment." }],
    },
    { isTemplate: false },
  );
  assert.equal(state.disabledReason, "The totals are still being checked. Try again in a moment.");
});

test("on the template chart Save draft says why it can't save", () => {
  const state = saveDraftState(READY_TO_SAVE, { isTemplate: true });
  assert.match(state.disabledReason ?? "", /default template/);
});

// ── The page's description ──

test("a reversal's page names the entry it reverses by the server's number, and never says it can only be reversed", () => {
  const text = journalPageDescription({
    status: "posted",
    reverses_journal_id: 14,
    reverses_journal_no: "JE-000014",
    reversed_by_journal_id: null,
  });
  assert.equal(text, "This entry reverses JE-000014.");
  assert.doesNotMatch(text, /only reversed/);
});

test("a reversal whose original's number isn't sent says \"another entry\"", () => {
  for (const reverses_journal_no of [null, undefined]) {
    const text = journalPageDescription({
      status: "posted",
      reverses_journal_id: 14,
      reverses_journal_no,
      reversed_by_journal_id: null,
    });
    assert.equal(text, "This entry reverses another entry.");
  }
  assert.equal(reversedEntryText({ reverses_journal_no: null }), "another entry");
  assert.equal(reversedEntryText({ reverses_journal_no: "JE-000014" }), "JE-000014");
});

test("the journal page loads one entry: the reversed entry's number comes with it", () => {
  const dir = join(process.cwd(), "src/app/(app)/accounting/journals");
  const page = readFileSync(join(dir, "[id]/page.tsx"), "utf8");
  const details = readFileSync(join(dir, "_components/journal-details.tsx"), "utf8");
  assert.equal(page.match(/accountingService\s*\.journal\(/g)?.length, 1);
  assert.doesNotMatch(page, /reverses_journal_id/);
  assert.doesNotMatch(details, /originalNo/);
  assert.match(details, /reversedEntryText\(entry\)/);
});

test("a draft, a posted entry and a reversed one each read their own way", () => {
  assert.equal(
    journalPageDescription({ status: "draft", reverses_journal_id: null, reversed_by_journal_id: null }),
    "A draft. Nothing moves in the books until it is posted.",
  );
  assert.equal(
    journalPageDescription({ status: "posted", reverses_journal_id: null, reversed_by_journal_id: null }),
    "Posted entries can't be edited, only reversed.",
  );
  assert.equal(
    journalPageDescription({ status: "reversed", reverses_journal_id: null, reversed_by_journal_id: 15 }),
    "This entry has been reversed. It stays in the books, and its reversing entry cancels it out.",
  );
});

test("an entry the server marks not reversible shows Reverse disabled with the server's reason", () => {
  const savings = { ...posted, source: "savings" as const, reversible: false, not_reversible_reason: "Reverse it from the savings account." };
  const actions = journalActions(savings, holding(...ALL), { editing: false, balance: "balanced" });
  assert.deepEqual(actions.reverse, { shown: true, disabledReason: "Reverse it from the savings account." });
  const noReason = journalActions({ ...savings, not_reversible_reason: "" }, holding(...ALL), { editing: false, balance: "balanced" });
  assert.equal(noReason.reverse.disabledReason, "This entry can't be reversed from the journal.");
});

test("a server that sends no reversible field keeps today's Reverse", () => {
  assert.deepEqual(journalActions(posted, holding(...ALL), { editing: false, balance: "balanced" }).reverse, {
    shown: true,
    disabledReason: null,
  });
  const marked = journalActions({ ...posted, reversible: true }, holding(...ALL), { editing: false, balance: "balanced" });
  assert.equal(marked.reverse.disabledReason, null);
});
