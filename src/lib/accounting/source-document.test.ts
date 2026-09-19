import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceDocument } from "./source-document";
import type { JournalEntry } from "@/types/accounting";

/**
 * Only the three postable fields matter here, and each of them is optional on
 * the wire — so the fixture takes a partial and adds nothing of its own.
 */
function entry(over: Partial<JournalEntry> = {}): Pick<
  JournalEntry,
  "postable_type" | "postable_id" | "postable_label"
> {
  return {
    postable_type: over.postable_type,
    postable_id: over.postable_id,
    postable_label: over.postable_label,
  };
}

// ── No source document at all ──

test("an entry with no postable has no source document", () => {
  // A fund transfer, a manual entry: the three fields are simply absent.
  assert.equal(sourceDocument(entry()), null);
});

test("an explicit null type is the same as no type", () => {
  // A reversal is refused a postable by the server, which sends nulls.
  assert.equal(
    sourceDocument(entry({ postable_type: null, postable_id: null, postable_label: null })),
    null
  );
});

test("a blank type is not a source document", () => {
  assert.equal(sourceDocument(entry({ postable_type: "  ", postable_id: 4 })), null);
});

// ── Routes: only where a page exists ──

test("a loan links to its detail page", () => {
  const doc = sourceDocument(
    entry({ postable_type: "loan", postable_id: 48, postable_label: "LN-000154" })
  );
  assert.equal(doc?.href, "/loans/48");
  assert.equal(doc?.text, "Loan LN-000154");
});

test("a repayment links to its receipt, keyed by the repayment id", () => {
  const doc = sourceDocument(
    entry({ postable_type: "repayment", postable_id: 12, postable_label: "OR-00000012" })
  );
  assert.equal(doc?.href, "/payments/12");
  assert.equal(doc?.text, "Payment OR-00000012");
});

test("an expense is named but not linked — there is no detail route", () => {
  const doc = sourceDocument(
    entry({ postable_type: "expense", postable_id: 7, postable_label: "Meralco" })
  );
  assert.equal(doc?.href, null);
  assert.equal(doc?.text, "Expense Meralco");
});

test("an expense payment has no route at all", () => {
  const doc = sourceDocument(entry({ postable_type: "expense_payment", postable_id: 9 }));
  assert.equal(doc?.href, null);
  assert.equal(doc?.text, "Expense payment #9");
});

test("a type nobody has mapped is readable and unlinked, never a crash", () => {
  // The server snake-cases the basename of any class it has not curated.
  const doc = sourceDocument(
    entry({ postable_type: "gcash_transaction", postable_id: 3, postable_label: "GC-77" })
  );
  assert.equal(doc?.href, null);
  assert.equal(doc?.text, "gcash transaction GC-77");
  assert.equal(doc?.type, "gcash_transaction");
});

test("a known type with no id cannot be linked — there is no url to build", () => {
  const doc = sourceDocument(entry({ postable_type: "loan", postable_label: "LN-000154" }));
  assert.equal(doc?.href, null);
  assert.equal(doc?.id, null);
  assert.equal(doc?.text, "Loan LN-000154");
});

// ── Labels: absent, null and blank all mean "unnamed" ──

test("a missing label key still names the document by its id", () => {
  // `postable_label` is whenLoaded server-side: the key can be absent, and a
  // linked entry with no label still needs something to click.
  const doc = sourceDocument(entry({ postable_type: "loan", postable_id: 48 }));
  assert.equal(doc?.label, null);
  assert.equal(doc?.text, "Loan #48");
  assert.equal(doc?.href, "/loans/48");
});

test("a null label reads exactly like an absent one", () => {
  const doc = sourceDocument(
    entry({ postable_type: "loan", postable_id: 48, postable_label: null })
  );
  assert.equal(doc?.text, "Loan #48");
});

test("a blank label is not a name", () => {
  const doc = sourceDocument(
    entry({ postable_type: "loan", postable_id: 48, postable_label: "   " })
  );
  assert.equal(doc?.label, null);
  assert.equal(doc?.text, "Loan #48");
});

test("a label is trimmed, not echoed", () => {
  const doc = sourceDocument(
    entry({ postable_type: "loan", postable_id: 48, postable_label: " LN-000154 " })
  );
  assert.equal(doc?.label, "LN-000154");
  assert.equal(doc?.text, "Loan LN-000154");
});

test("with neither label nor id, the kind alone is the name", () => {
  const doc = sourceDocument(entry({ postable_type: "expense_payment" }));
  assert.equal(doc?.text, "Expense payment");
  assert.equal(doc?.href, null);
});

test("id 0 is an id, not a missing one", () => {
  // Falsy-but-present: the difference between "#0" and "Loan".
  const doc = sourceDocument(entry({ postable_type: "loan", postable_id: 0 }));
  assert.equal(doc?.id, 0);
  assert.equal(doc?.text, "Loan #0");
  assert.equal(doc?.href, "/loans/0");
});
