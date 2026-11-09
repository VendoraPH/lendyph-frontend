/**
 * The Auto-Credit page's three member groups, as the server sorts them.
 *
 * WHAT THIS PROVES: "will not be credited" counts only the pledges whose
 * auto-credit is off (`disabled_members`), never the members with no pledge
 * amount; the no-pledge list is the server's own, each row marked by whether
 * its auto-credit is on; and the counts are the server's when it sends them.
 * WHAT IT DOES NOT PROVE: who lands in which group (backend tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { autoCreditGroups, serverTotalToCredit } from "./auto-credit-groups";

const STATUS = {
  active_count: 2,
  disabled_count: 1,
  no_pledge_count: 2,
  active_members: [
    { id: 1, borrower_name: "Ana Cruz", pledge_amount: 500 },
    { id: 2, borrower_name: "Ben Reyes", pledge_amount: 250 },
  ],
  disabled_members: [{ id: 3, borrower_name: "Carla Lim", pledge_amount: 0 }],
  // Pledge 3 has no amount and auto-credit off: it is in both server lists.
  no_pledge_members: [
    { id: 3, borrower_name: "Carla Lim" },
    { id: 4, borrower_name: "Dan Uy" },
  ],
};

test("will not be credited counts only pledges whose auto-credit is off", () => {
  const groups = autoCreditGroups(STATUS);
  assert.equal(groups.disabledCount, 1);
  assert.deepEqual(groups.disabled.map((m) => m.id), [3]);
});

test("the no-pledge list is the server's, each row marked by its auto-credit", () => {
  const groups = autoCreditGroups(STATUS);
  assert.equal(groups.noPledgeCount, 2);
  assert.deepEqual(
    groups.noPledge.map((m) => [m.id, m.borrower, m.autoCredit]),
    [
      [3, "Carla Lim", false],
      [4, "Dan Uy", true],
    ],
  );
});

test("the active list and count are the server's", () => {
  const groups = autoCreditGroups(STATUS);
  assert.equal(groups.activeCount, 2);
  assert.deepEqual(groups.active.map((m) => [m.id, m.pledgeAmount, m.autoCredit]), [
    [1, 500, true],
    [2, 250, true],
  ]);
});

test("without the server's counts, each list's length stands; an empty status is empty", () => {
  const groups = autoCreditGroups({
    active_members: STATUS.active_members,
    disabled_members: STATUS.disabled_members,
    no_pledge_members: STATUS.no_pledge_members,
  });
  assert.deepEqual([groups.activeCount, groups.disabledCount, groups.noPledgeCount], [2, 1, 2]);
  const empty = autoCreditGroups({});
  assert.deepEqual([empty.active, empty.disabled, empty.noPledge], [[], [], []]);
  assert.deepEqual([empty.activeCount, empty.disabledCount, empty.noPledgeCount], [0, 0, 0]);
});

test("the page counts its warnings from the groups", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/share-capital/auto-credit/page.tsx"), "utf8");
  assert.ok(page.includes("autoCreditGroups(raw)"));
  assert.ok(page.includes("{groups.disabledCount} member"));
  assert.ok(!page.includes("...noPledgeArr.map((m) => ({ ...toLocalMember(m), autoCredit: false }))"));
});

test("the total to credit is read as the server sent it: 0 stays 0, nothing is null", () => {
  assert.equal(serverTotalToCredit({ total_to_credit: 750 }), 750);
  assert.equal(serverTotalToCredit({ total_to_credit: "750.50" }), 750.5);
  assert.equal(serverTotalToCredit({ total_to_credit: 0 }), 0);
  assert.equal(serverTotalToCredit({}), null);
  assert.equal(serverTotalToCredit({ total_to_credit: null }), null);
  assert.equal(serverTotalToCredit({ total_to_credit: "n/a" }), null);
});
