import { test } from "node:test";
import assert from "node:assert/strict";
import { branchCountCards, NOT_AVAILABLE } from "./branch-counts";

test("each count reads the server's figure", () => {
  const cards = branchCountCards({
    pending_transfers: 2,
    in_transit_transfers: 1,
    suspended_branches: 0,
    unreconciled_branches: 3,
  });
  assert.deepEqual(
    cards.map((c) => [c.key, c.label, c.value]),
    [
      ["pending_transfers", "Transfers waiting for approval", "2"],
      ["in_transit_transfers", "Transfers in transit", "1"],
      ["suspended_branches", "Suspended branches", "0"],
      ["unreconciled_branches", "Branches not yet reconciled", "3"],
    ],
  );
  assert.equal(cards.every((c) => c.available), true);
});

test("a null count, which the server sends without that figure's permission, reads Not available, never 0", () => {
  const cards = branchCountCards({
    pending_transfers: null,
    in_transit_transfers: null,
    suspended_branches: 1,
    unreconciled_branches: null,
  });
  assert.equal(NOT_AVAILABLE, "Not available");
  assert.deepEqual(cards.map((c) => c.value), [NOT_AVAILABLE, NOT_AVAILABLE, "1", NOT_AVAILABLE]);
  assert.deepEqual(cards.map((c) => c.available), [false, false, true, false]);
});

test("a missing or odd figure reads Not available too, so an older answer never shows a made-up 0", () => {
  const cards = branchCountCards({} as never);
  assert.deepEqual(cards.map((c) => c.value), [NOT_AVAILABLE, NOT_AVAILABLE, NOT_AVAILABLE, NOT_AVAILABLE]);
});

test("every card says what it counts, in words", () => {
  for (const card of branchCountCards({ pending_transfers: 1, in_transit_transfers: 1, suspended_branches: 1, unreconciled_branches: 1 })) {
    assert.ok(card.hint.trim().length > 0, card.key);
    assert.doesNotMatch(card.label + card.hint, /_/);
  }
});
