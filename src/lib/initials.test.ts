import { test } from "node:test";
import assert from "node:assert/strict";
import { getInitials } from "./initials";

// ── The empty-ish inputs, which is the whole reason this helper exists ──
//
// Every one of these threw in at least one of the four copies this replaces.
// `undefined` is the production failure mode: `full_name` is typed
// non-optional, so nothing upstream of here ever checks it.

test("undefined does not throw", () => {
  assert.equal(getInitials(undefined), "?");
});

test("null does not throw", () => {
  assert.equal(getInitials(null), "?");
});

test("an empty string does not throw", () => {
  // The dashboard copy died here: `"".split(" ").filter(Boolean)` is `[]`, and
  // it then read `parts[0][0]`.
  assert.equal(getInitials(""), "?");
});

test("a whitespace-only name does not throw", () => {
  assert.equal(getInitials("   "), "?");
});

test("a tab/newline-only name does not throw", () => {
  assert.equal(getInitials("\t\n "), "?");
});

test("a non-string slipping past the types lands on the fallback", () => {
  // Not reachable per the type signature; reachable per the wire.
  assert.equal(getInitials(42 as unknown as string), "?");
  assert.equal(getInitials({} as unknown as string), "?");
});

test("the fallback is overridable, including to an empty chip", () => {
  assert.equal(getInitials(undefined, ""), "");
  assert.equal(getInitials("", "–"), "–");
});

// ── Names ──

test("a two-word name takes the first letter of each", () => {
  assert.equal(getInitials("Juan Cruz"), "JC");
});

test("a single-word name takes its first two letters", () => {
  assert.equal(getInitials("Madonna"), "MA");
});

test("a single-letter name yields that one letter, not a crash", () => {
  assert.equal(getInitials("J"), "J");
});

test("three or more words still take the FIRST two words", () => {
  // Deliberate: the dashboard copy took first-and-last ("JC" here). The
  // borrowers module — where most avatars in this app live — takes the first
  // two, so that is what the shared helper does.
  assert.equal(getInitials("Juan Miguel Dela Cruz"), "JM");
});

test("initials are uppercased regardless of input casing", () => {
  assert.equal(getInitials("juan cruz"), "JC");
  assert.equal(getInitials("mADONNA"), "MA");
});

test("leading, trailing and repeated whitespace is ignored", () => {
  assert.equal(getInitials("  Juan   Cruz  "), "JC");
});

test("a name broken across a newline or tab still reads as two words", () => {
  assert.equal(getInitials("Juan\tCruz"), "JC");
  assert.equal(getInitials("Juan\nCruz"), "JC");
});

test("a non-Latin name is not mangled", () => {
  assert.equal(getInitials("Ñoño Ramírez"), "ÑR");
});

test("a hyphenated surname counts as one word", () => {
  assert.equal(getInitials("Ana Cruz-Reyes"), "AC");
});

test("a name that is only punctuation still returns something renderable", () => {
  // The audit trail passes "?" in by hand today; it must survive the round trip.
  assert.equal(getInitials("?"), "?");
});
