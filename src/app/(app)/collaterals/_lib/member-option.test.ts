import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { knownMemberId, memberPlaceholderOption } from "./member-option";

describe("the member a collateral form opens with", () => {
  test("an edit keeps the collateral's own member, whatever the link says", () => {
    assert.equal(knownMemberId({ borrower_id: 4 }, "9"), 4);
  });

  test("a new collateral takes the member from the link", () => {
    assert.equal(knownMemberId(undefined, "9"), 9);
  });

  test("no member on either, or a link that is not an id, means none", () => {
    assert.equal(knownMemberId(undefined, null), null);
    assert.equal(knownMemberId(undefined, "abc"), null);
    assert.equal(knownMemberId(undefined, "0"), null);
  });

  // A chosen member must never look unchosen: the save would still send the id.
  test("until the name is read, or if it can't be, the id stands in", () => {
    assert.deepEqual(memberPlaceholderOption(9), { id: 9, full_name: "Member #9" });
  });
});
