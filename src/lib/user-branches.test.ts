import test from "node:test";
import assert from "node:assert/strict";

import {
  allBranchesLabel,
  branchFilterItems,
  branchPicker,
  branchSelectItems,
  branchViewer,
  lacksBranchAccess,
  pickedBranchLabel,
  primaryBranchId,
  userBranchIds,
  userBranches,
  visibleBranches,
  withUserBranches,
  worksOutsideCallerBranches,
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

// The member form's branch picker. Base UI 1.8 reads the closed select's label
// from `items`; without them a user with two branches saw "3", not "Main".
test("branch select items label each branch by name", () => {
  assert.deepEqual(
    branchSelectItems([main, north]).map((i) => i.label),
    ["Main", "North"],
  );
});

test("branch select items carry the id as a string, the value the form holds", () => {
  assert.deepEqual(
    branchSelectItems([main, north]).map((i) => i.value),
    ["3", "9"],
  );
});

test("no branches means no select items", () => {
  assert.deepEqual(branchSelectItems([]), []);
});

// The accounting branch filter. Its closed trigger showed "all" or a raw id
// until the filter passed `items`, including one for the "all" value.
test("branch filter items label the all value \"All branches\"", () => {
  assert.deepEqual(branchFilterItems([main, north], "all")[0], {
    value: "all",
    label: "All branches",
  });
});

test("branch filter items label each branch id by its name", () => {
  assert.deepEqual(branchFilterItems([main, north], "all").slice(1), [
    { value: "3", label: "Main" },
    { value: "9", label: "North" },
  ]);
});

test("branch filter items still offer all branches when none loaded", () => {
  assert.deepEqual(branchFilterItems([], "all"), [
    { value: "all", label: "All branches" },
  ]);
});

// ── Branch access (`branches:view_all`, backend #211) ──
//
// `GET /branches` lists every branch, but the API answers 403 to a `branch_id`
// filter outside the caller's branches and refuses to assign one to a user. So
// a caller without `view_all` is offered only their own.

const south = { id: 12, name: "South", code: "SO" };
const allBranches = [main, north, south];
const northOnly = { branches: [north] } as unknown as User;

test("a viewer reads their own branch ids, in either shape", () => {
  assert.deepEqual(branchViewer(newShape, false), { viewAll: false, branchIds: [3, 9] });
  assert.deepEqual(branchViewer(oldShape, true), { viewAll: true, branchIds: [3] });
  assert.deepEqual(branchViewer(null, false), { viewAll: false, branchIds: [] });
});

test("without view_all only the viewer's own branches are visible, in list order", () => {
  assert.deepEqual(visibleBranches(allBranches, branchViewer(newShape, false)), [main, north]);
  assert.deepEqual(visibleBranches(allBranches, branchViewer(northOnly, false)), [north]);
});

test("view_all sees every branch", () => {
  assert.deepEqual(visibleBranches(allBranches, branchViewer(northOnly, true)), allBranches);
});

test("no viewer means no narrowing", () => {
  assert.deepEqual(visibleBranches(allBranches), allBranches);
});

test("a viewer with no branch and no view_all sees no branch", () => {
  assert.deepEqual(visibleBranches(allBranches, branchViewer({} as User, false)), []);
});

test("visible branches is a copy, never the caller's array", () => {
  const list = [main, north];
  assert.notEqual(visibleBranches(list), list);
});

test("branch select items offer only the viewer's branches without view_all", () => {
  assert.deepEqual(branchSelectItems(allBranches, branchViewer(northOnly, false)), [
    { value: "9", label: "North" },
  ]);
  assert.equal(branchSelectItems(allBranches, branchViewer(northOnly, true)).length, 3);
});

test("branch filter items offer only the viewer's branches without view_all", () => {
  assert.deepEqual(branchFilterItems(allBranches, "all", branchViewer(northOnly, false)), [
    { value: "all", label: "All my branches" },
    { value: "9", label: "North" },
  ]);
});

test("branch filter items keep \"All branches\" and every branch with view_all", () => {
  const items = branchFilterItems(allBranches, "all", branchViewer(northOnly, true));
  assert.deepEqual(items[0], { value: "all", label: "All branches" });
  assert.equal(items.length, 4);
});

test("the all-branches label says whose branches it means", () => {
  assert.equal(allBranchesLabel(), "All branches");
  assert.equal(allBranchesLabel(branchViewer(northOnly, true)), "All branches");
  assert.equal(allBranchesLabel(branchViewer(northOnly, false)), "All my branches");
});

test("no branch and no view_all lacks branch access", () => {
  assert.equal(lacksBranchAccess({ branches: [] } as unknown as User, false), true);
  assert.equal(lacksBranchAccess({} as User, false), true);
});

test("a branch, or view_all, is branch access", () => {
  assert.equal(lacksBranchAccess(northOnly, false), false);
  assert.equal(lacksBranchAccess(oldShape, false), false);
  assert.equal(lacksBranchAccess({ branches: [] } as unknown as User, true), false);
});

test("an unknown user (before rehydration) is not reported as lacking access", () => {
  assert.equal(lacksBranchAccess(null, false), false);
  assert.equal(lacksBranchAccess(undefined, false), false);
});

// The accounting BranchFilter renders its options from `visibleBranches` and
// hands Base UI `branchFilterItems` for the trigger label. Both read the same
// viewer, so the two lists must name the same branches in the same order.
test("filter items and visible branches agree for a scoped and an unscoped viewer", () => {
  for (const viewer of [branchViewer(newShape, false), branchViewer(northOnly, true)]) {
    assert.deepEqual(
      branchFilterItems(allBranches, "all", viewer).map((i) => i.value),
      ["all", ...visibleBranches(allBranches, viewer).map((b) => String(b.id))],
    );
    assert.equal(branchFilterItems(allBranches, "all", viewer)[0].label, allBranchesLabel(viewer));
  }
});

// The accounting filter's own ApiBranch rows carry more than UserBranch does.
test("visible branches keeps the caller's row type", () => {
  const rows = [{ ...main, is_active: true }, { ...north, is_active: true }];
  const shown = visibleBranches(rows, branchViewer(northOnly, false));
  assert.deepEqual(shown, [{ ...north, is_active: true }]);
});

// ── branchPicker: the one call every picker makes ──
//
// Each picker hands this its loaded list, the signed-in user and
// `can("branches:view_all")`. These pin that the viewer is built from both.

test("a picker for a caller without view_all offers only their branches", () => {
  const picker = branchPicker(allBranches, northOnly, false);
  assert.deepEqual(picker.branches, [north]);
  assert.equal(picker.allLabel, "All my branches");
  assert.deepEqual(picker.viewer, { viewAll: false, branchIds: [9] });
});

test("a picker for a caller with view_all offers every branch", () => {
  const picker = branchPicker(allBranches, northOnly, true);
  assert.deepEqual(picker.branches, allBranches);
  assert.equal(picker.allLabel, "All branches");
});

test("a picker reads the caller's branches in the legacy shape too", () => {
  assert.deepEqual(branchPicker(allBranches, oldShape, false).branches, [main]);
});

test("a picker for a caller with no branch and no view_all offers none", () => {
  assert.deepEqual(branchPicker(allBranches, {} as User, false).branches, []);
});

// ── worksOutsideCallerBranches (users page: Edit, Reset Password, Deactivate) ──

const caller = { id: 1, branches: [main, north] } as unknown as User;

test("a target in a branch the caller doesn't hold is out of reach", () => {
  const target = { id: 2, branches: [north, south] } as unknown as User;
  assert.equal(worksOutsideCallerBranches(target, caller, false), true);
});

test("a target inside the caller's branches is in reach", () => {
  const target = { id: 2, branches: [north] } as unknown as User;
  assert.equal(worksOutsideCallerBranches(target, caller, false), false);
  assert.equal(worksOutsideCallerBranches({ id: 3, branch: main } as unknown as User, caller, false), false);
});

test("view_all reaches every target", () => {
  const target = { id: 2, branches: [south] } as unknown as User;
  assert.equal(worksOutsideCallerBranches(target, caller, true), false);
});

test("the caller's own account is always in reach", () => {
  const self = { id: 1, branches: [main, north] } as unknown as User;
  const narrowSelf = { id: 1, branches: [north] } as unknown as User;
  assert.equal(worksOutsideCallerBranches(self, narrowSelf, false), false);
});

test("an unknown caller claims nothing", () => {
  const target = { id: 2, branches: [south] } as unknown as User;
  assert.equal(worksOutsideCallerBranches(target, null, false), false);
});

test("a target with no branch is in reach", () => {
  assert.equal(worksOutsideCallerBranches({ id: 2, branches: [] } as unknown as User, caller, false), false);
});

// ── pickedBranchLabel: the report's "Branch:" line, on screen and in exports ──

test("a selected branch is labelled by its name", () => {
  assert.equal(pickedBranchLabel(branchPicker(allBranches, northOnly, false), 9, "All Branches"), "North");
  assert.equal(pickedBranchLabel(branchPicker(allBranches, northOnly, true), 12, "All Branches"), "South");
});

test("no branch reads the view_all label for a caller with view_all", () => {
  assert.equal(pickedBranchLabel(branchPicker(allBranches, northOnly, true), null, "All Branches"), "All Branches");
  assert.equal(pickedBranchLabel(branchPicker(allBranches, northOnly, true), null), "All branches");
});

test("no branch reads \"All my branches\" for a caller without view_all", () => {
  // The report then covers only the caller's branches; "All Branches" on an
  // exported PDF would claim the whole cooperative.
  assert.equal(pickedBranchLabel(branchPicker(allBranches, northOnly, false), null, "All Branches"), "All my branches");
});

test("a selected branch the picker doesn't offer is never named", () => {
  assert.equal(pickedBranchLabel(branchPicker(allBranches, northOnly, false), 12, "All Branches"), "All my branches");
});
