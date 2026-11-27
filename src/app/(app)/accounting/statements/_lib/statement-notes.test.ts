import { test } from "node:test";
import assert from "node:assert/strict";
import type { Permission } from "@/types";
import type { StatementNotesPesos } from "@/types/cda";
import { formatDate } from "@/lib/format";
import { canSeeStatementNotes, pesosNote } from "./statement-notes";

const DISCLOSURE = "Enhanced PESOS figures follow a placeholder template still to be checked against the official CDA MC 2025-12 tool.";

const base: StatementNotesPesos = {
  year: 2026,
  score: null,
  rating: null,
  source: null,
  provisional: null,
  finalized_at: null,
  verified: false,
  disclosure: null,
};

test("a finalized PESOS report reads Finalized with its date, and its frozen score and rating", () => {
  const note = pesosNote({
    ...base,
    score: "78.50",
    rating: "Very Good",
    source: "finalized",
    provisional: false,
    finalized_at: "2026-11-12T03:15:00.000000Z",
    verified: true,
  });
  assert.equal(note.score, "78.50");
  assert.equal(note.rating, "Very Good");
  assert.equal(note.status, `Finalized ${formatDate("2026-11-12T03:15:00.000000Z")}`);
  assert.equal(note.toVerify, null);
  assert.equal(note.inUse, true);
});

test("the live result reads Provisional, and To verify while the rules aren't verified", () => {
  const note = pesosNote({ ...base, score: "61.25", rating: null, source: "live", provisional: true, disclosure: DISCLOSURE });
  assert.equal(note.status, "Provisional");
  assert.equal(note.score, "61.25");
  assert.equal(note.rating, "—");
  assert.equal(note.toVerify, "To verify against the official CDA tool");
  assert.equal(note.disclosure, DISCLOSURE);
});

test("a year with no CDA reporting period shows a dash for every figure", () => {
  const note = pesosNote(base);
  assert.equal(note.score, "—");
  assert.equal(note.rating, "—");
  assert.equal(note.status, "—");
  assert.equal(note.inUse, false);
});

test("the Notes tab needs accounting:view, branches:view_all and CDA switched on", () => {
  const holds = (...held: Permission[]) => (p: Permission) => held.includes(p);
  assert.equal(canSeeStatementNotes(holds("accounting:view", "branches:view_all"), true), true);
  assert.equal(canSeeStatementNotes(holds("accounting:view", "branches:view_all"), false), false);
  assert.equal(canSeeStatementNotes(holds("accounting:view"), true), false);
  assert.equal(canSeeStatementNotes(holds("branches:view_all"), true), false);
});
