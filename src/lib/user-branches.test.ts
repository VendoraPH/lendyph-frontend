import test from "node:test";
import assert from "node:assert/strict";

import {
  primaryBranchId,
  userBranchIds,
  userBranches,
  withUserBranches,
} from "./user-branches";
import type { User } from "@/types";

const main = { id: 3, name: "Main", code: "MN" };
const north = { id: 9, name: "North", code: "NO" };

// The shapes below are cast the same way `api.get<User>()` casts the wire: no
// runtime check stands between the JSON and these types, which is the whole
// reason these helpers exist.
const newShape = { branches: [main, north] } as unknown as User;
const oldShape = { branch: main } as unknown as User;

test("the new shape is returned as-is", () => {
  assert.deepEqual(userBranches(newShape), [main, north]);
});

test("the pre-multi-branch `branch` is read as a one-item list", () => {
  assert.deepEqual(userBranches(oldShape), [main]);
});

test("a user carrying neither shape yields an empty list, not a crash", () => {
  assert.deepEqual(userBranches({} as User), []);
});

test("no user at all yields an empty list", () => {
  // The signed-in user is null before hydration and on every public page.
  assert.deepEqual(userBranches(null), []);
  assert.deepEqual(userBranches(undefined), []);
});

test("an explicitly null branch assignment is empty either way", () => {
  assert.deepEqual(userBranches({ branch: null } as unknown as User), []);
  assert.deepEqual(userBranches({ branches: null } as unknown as User), []);
});

test("a null `branches` still falls through to `branch`", () => {
  // Untyped JSON: an API that emits both keys but leaves the new one null must
  // not shadow the value that is actually there.
  const both = { branches: null, branch: main } as unknown as User;
  assert.deepEqual(userBranches(both), [main]);
});

test("the new shape wins when both are present", () => {
  const both = { branches: [north], branch: main } as unknown as User;
  assert.deepEqual(userBranches(both), [north]);
});

test("an empty `branches` is an answer, not a missing one", () => {
  // A genuinely unassigned user on the new API. It must NOT fall back to a
  // stale `branch`, or removing someone's last branch would look undone.
  const unassigned = { branches: [], branch: main } as unknown as User;
  assert.deepEqual(userBranches(unassigned), []);
});

test("branch ids come out of either shape", () => {
  assert.deepEqual(userBranchIds(newShape), [3, 9]);
  assert.deepEqual(userBranchIds(oldShape), [3]);
  assert.deepEqual(userBranchIds(null), []);
});

test("the compatibility `branch_id` is one of the selected branches", () => {
  assert.equal(primaryBranchId([9, 3]), 3);
  assert.equal(primaryBranchId([3]), 3);
});

test("the compatibility `branch_id` ignores selection order", () => {
  // Load-bearing: `userEditChanges` compares branch_ids as a SET, so two
  // payloads it calls identical must not disagree about `branch_id` — that
  // would be a field the change check cannot see moving on its own.
  assert.equal(primaryBranchId([3, 9]), primaryBranchId([9, 3]));
});

test("no branches selected means no `branch_id` key on the wire", () => {
  // `undefined` is dropped by JSON.stringify, so the server sees the key
  // omitted rather than nulled.
  assert.equal(primaryBranchId([]), undefined);
});

test("an old persisted user is migrated to the new shape", () => {
  assert.deepEqual(withUserBranches({ id: 7, branch: main }), {
    id: 7,
    branch: main,
    branches: [main],
  });
});

test("a persisted user with no branch at all still gains the key", () => {
  assert.deepEqual(withUserBranches({ id: 7 }), { id: 7, branches: [] });
});

test("a user already on the new shape is returned by reference", () => {
  // Rehydrating a current session should allocate nothing and, more to the
  // point, must not replace `user` with an equal-but-different object.
  const user = { id: 7, branches: [main] };
  assert.equal(withUserBranches(user), user);
});

test("migrating a signed-out session leaves null alone", () => {
  assert.equal(withUserBranches(null), null);
  assert.equal(withUserBranches(undefined), undefined);
});
