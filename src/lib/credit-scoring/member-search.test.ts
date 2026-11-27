import { test } from "node:test";
import assert from "node:assert/strict";
import { MEMBER_SEARCH_MAX, memberSearchParam } from "./member-search";

test("the search goes trimmed with single spaces, and an empty box sends none", () => {
  assert.equal(memberSearchParam("  Ana   Cruz "), "Ana Cruz");
  assert.equal(memberSearchParam("M-0004"), "M-0004");
  assert.equal(memberSearchParam("   "), undefined);
  assert.equal(memberSearchParam(""), undefined);
});

test("the search never goes over the server's 100 characters", () => {
  assert.equal(MEMBER_SEARCH_MAX, 100);
  assert.equal(memberSearchParam("a".repeat(150))?.length, 100);
});
