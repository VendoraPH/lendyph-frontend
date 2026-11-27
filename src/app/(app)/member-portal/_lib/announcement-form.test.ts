import { test } from "node:test";
import assert from "node:assert/strict";
import { audienceText, audiencesFor, draftBody, draftOf, draftProblems, fromManilaInput, toManilaInput } from "./announcement-form";

test("company-wide audiences need every branch", () => {
  assert.deepEqual(audiencesFor(true), ["all", "branch", "member_type"]);
  assert.deepEqual(audiencesFor(false), ["branch"]);
  assert.equal(draftOf(null, false).audience, "branch");
  assert.equal(draftOf(null, true).audience, "all");
});

test("times are typed in Philippine time and sent with their offset", () => {
  assert.equal(toManilaInput("2026-11-12T01:30:00.000Z"), "2026-11-12T09:30");
  assert.equal(toManilaInput("2026-11-11T20:00:00Z"), "2026-11-12T04:00");
  assert.equal(fromManilaInput("2026-11-12T09:30"), "2026-11-12T09:30:00+08:00");
  assert.equal(fromManilaInput(""), null);
  assert.equal(toManilaInput(null), "");
});

test("a draft needs a title, a message and its audience's list", () => {
  const d = { ...draftOf(null, true), audience: "branch" as const };
  assert.deepEqual(draftProblems(d, true), ["Give the announcement a title.", "Write the announcement.", "Choose at least one branch."]);
  const typed = { ...d, title: "Holiday", body: "Closed", audience: "member_type" as const };
  assert.deepEqual(draftProblems(typed, true), ["Choose at least one member type."]);
  assert.match(draftProblems({ ...typed, member_types: ["regular"] }, false)[0], /all branches/);
  assert.deepEqual(draftProblems({ ...typed, member_types: ["regular"], publish_at: "2026-11-12T09:00", expires_at: "2026-11-12T08:00" }, true), [
    "The end must be after the start.",
  ]);
});

test("the body sends only its audience's own list", () => {
  const body = draftBody({
    title: " Holiday ",
    body: " Closed on Monday ",
    audience: "branch",
    branch_ids: [2],
    member_types: ["regular"],
    publish_at: "",
    expires_at: "2026-11-20T17:00",
    pinned: true,
  });
  assert.deepEqual(body, {
    title: "Holiday",
    body: "Closed on Monday",
    audience: "branch",
    branch_ids: [2],
    publish_at: null,
    expires_at: "2026-11-20T17:00:00+08:00",
    pinned: true,
  });
});

test("who sees it reads in words", () => {
  assert.equal(audienceText({ audience: "all", branches: [], member_types: [] }), "All members");
  assert.equal(audienceText({ audience: "branch", branches: [{ id: 1, name: "Main" }, { id: 2, name: "North" }], member_types: [] }), "Members of Main, North");
  assert.equal(audienceText({ audience: "member_type", branches: [], member_types: ["regular", "associate"] }), "Regular members and Associate members");
});
