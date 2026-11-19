import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ALL_BRANCHES } from "./branch-filter";
import { branchViewer } from "./user-branches";
import {
  branchFilterDefault,
  forgetWorkingBranch,
  initialBranchFilters,
  nextBranchFilters,
  readWorkingBranch,
  shownBranchFilters,
  workingBranchFor,
  workingBranchKey,
  workingBranchPreset,
  workingBranchSelector,
  workingBranchSelectorValue,
  writeWorkingBranch,
} from "./working-branch";

const NORTH = { id: 1, name: "North", code: "N" };
const SOUTH = { id: 2, name: "South", code: "S" };
const EAST = { id: 3, name: "East", code: "E" };
const LISTED = [NORTH, SOUTH, EAST];

/** A Map-backed storage, optionally one that throws on every call (blocked or full). */
function memoryStorage(opts: { throws?: boolean } = {}) {
  const map = new Map<string, string>();
  const guard = () => {
    if (opts.throws) throw new Error("SecurityError");
  };
  return {
    map,
    storage: () => ({
      getItem: (k: string) => {
        guard();
        return map.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        guard();
        map.set(k, v);
      },
      removeItem: (k: string) => {
        guard();
        map.delete(k);
      },
    }),
  };
}

const viewAll = branchViewer({ branches: [NORTH] }, true);
const twoBranches = branchViewer({ branches: [NORTH, SOUTH] }, false);
const oneBranch = branchViewer({ branches: [SOUTH] }, false);
const noBranch = branchViewer({ branches: [] }, false);

describe("working branch storage", () => {
  test("is kept per user, under a key holding the user's id", () => {
    const m = memoryStorage();
    writeWorkingBranch(m.storage, 7, 2);
    writeWorkingBranch(m.storage, 8, 3);
    assert.equal(m.map.get(workingBranchKey(7)), "2");
    assert.equal(readWorkingBranch(m.storage, 7), 2);
    assert.equal(readWorkingBranch(m.storage, 8), 3);
    assert.equal(readWorkingBranch(m.storage, 9), null);
  });

  test("no user reads nothing and writes nothing", () => {
    const m = memoryStorage();
    writeWorkingBranch(m.storage, null, 2);
    assert.equal(m.map.size, 0);
    assert.equal(readWorkingBranch(m.storage, null), null);
  });

  test("writing no branch (All branches) removes the stored one", () => {
    const m = memoryStorage();
    writeWorkingBranch(m.storage, 7, 2);
    writeWorkingBranch(m.storage, 7, null);
    assert.equal(m.map.has(workingBranchKey(7)), false);
  });

  test("an unreadable stored value reads as none", () => {
    for (const raw of ["", "all", "0", "-1", "2.5", "1e3", " 2", "abc"]) {
      const m = memoryStorage();
      m.map.set(workingBranchKey(7), raw);
      assert.equal(readWorkingBranch(m.storage, 7), null, JSON.stringify(raw));
    }
  });

  test("a blocked or full storage never throws: reads none, drops writes", () => {
    const m = memoryStorage({ throws: true });
    assert.doesNotThrow(() => writeWorkingBranch(m.storage, 7, 2));
    assert.equal(readWorkingBranch(m.storage, 7), null);
    assert.doesNotThrow(() => forgetWorkingBranch(m.storage, 7));
    assert.doesNotThrow(() => readWorkingBranch(() => { throw new Error("no window"); }, 7));
  });

  test("sign-out forgets only the signed-out user's branch", () => {
    const m = memoryStorage();
    writeWorkingBranch(m.storage, 7, 2);
    writeWorkingBranch(m.storage, 8, 3);
    forgetWorkingBranch(m.storage, 7);
    assert.equal(readWorkingBranch(m.storage, 7), null);
    assert.equal(readWorkingBranch(m.storage, 8), 3);
  });
});

describe("workingBranchFor", () => {
  test("flag off: never a working branch, whatever is stored", () => {
    assert.equal(workingBranchFor({ enabled: false, stored: 2, viewer: twoBranches }), null);
    assert.equal(workingBranchFor({ enabled: false, stored: 2, viewer: viewAll }), null);
  });

  test("a branch user's stored branch counts only while it is still theirs", () => {
    assert.equal(workingBranchFor({ enabled: true, stored: 2, viewer: twoBranches }), 2);
    assert.equal(workingBranchFor({ enabled: true, stored: 3, viewer: twoBranches }), null);
    assert.equal(workingBranchFor({ enabled: true, stored: 1, viewer: noBranch }), null);
  });

  test("view_all: any branch until the list loads, then only a listed one", () => {
    assert.equal(workingBranchFor({ enabled: true, stored: 3, viewer: viewAll }), 3);
    assert.equal(workingBranchFor({ enabled: true, stored: 3, viewer: viewAll, listed: LISTED }), 3);
    assert.equal(workingBranchFor({ enabled: true, stored: 9, viewer: viewAll, listed: LISTED }), null);
  });

  test("a branch user's loaded list drops a branch that was deactivated", () => {
    assert.equal(workingBranchFor({ enabled: true, stored: 2, viewer: twoBranches, listed: [NORTH] }), null);
  });

  test("nothing stored is no working branch", () => {
    assert.equal(workingBranchFor({ enabled: true, stored: null, viewer: viewAll }), null);
  });
});

describe("branchFilterDefault: the URL wins, then the working branch, then today's default", () => {
  test("a page's own ?branch= wins over the working branch", () => {
    assert.equal(branchFilterDefault({ url: "3", working: 2, fallback: ALL_BRANCHES }), "3");
  });

  test("no URL: the working branch", () => {
    assert.equal(branchFilterDefault({ url: null, working: 2, fallback: ALL_BRANCHES }), "2");
    assert.equal(branchFilterDefault({ working: 2, fallback: ALL_BRANCHES }), "2");
  });

  test("neither: today's default, the page's own", () => {
    assert.equal(branchFilterDefault({ url: null, working: null, fallback: ALL_BRANCHES }), ALL_BRANCHES);
    assert.equal(branchFilterDefault({ working: null, fallback: "any" }), "any");
  });

  test("an empty ?branch= is no URL filter", () => {
    assert.equal(branchFilterDefault({ url: "", working: 2, fallback: ALL_BRANCHES }), "2");
  });

  test("end to end: a stale stored branch falls back to today's default", () => {
    const working = workingBranchFor({ enabled: true, stored: 3, viewer: twoBranches });
    assert.equal(branchFilterDefault({ url: null, working, fallback: ALL_BRANCHES }), ALL_BRANCHES);
  });
});

describe("workingBranchPreset: a form picker's preselection", () => {
  const offered = ["none", "1", "2"];

  test("the working branch when the form offers it", () => {
    assert.equal(workingBranchPreset(2, offered, "none"), "2");
  });

  test("otherwise the form's own preselection", () => {
    assert.equal(workingBranchPreset(3, offered, "none"), "none");
    assert.equal(workingBranchPreset(null, offered, null), null);
  });
});

describe("workingBranchSelector: what the header shows", () => {
  test("view_all: All branches first, then every listed branch", () => {
    const s = workingBranchSelector({ viewAll: true, own: [NORTH], listed: LISTED });
    assert.deepEqual(s, {
      kind: "select",
      items: [
        { value: ALL_BRANCHES, label: "All branches" },
        { value: "1", label: "North" },
        { value: "2", label: "South" },
        { value: "3", label: "East" },
      ],
    });
  });

  test("view_all with the list not loaded still offers All branches and their own", () => {
    const s = workingBranchSelector({ viewAll: true, own: [NORTH], listed: [] });
    assert.deepEqual(s, {
      kind: "select",
      items: [
        { value: ALL_BRANCHES, label: "All branches" },
        { value: "1", label: "North" },
      ],
    });
  });

  test("a branch user with several branches: only theirs, and no All branches", () => {
    const s = workingBranchSelector({ viewAll: false, own: [NORTH, SOUTH], listed: LISTED });
    assert.deepEqual(s, {
      kind: "select",
      items: [
        { value: "1", label: "North" },
        { value: "2", label: "South" },
      ],
    });
  });

  test("a branch user's own branches stand in while the list loads", () => {
    const s = workingBranchSelector({ viewAll: false, own: [NORTH, SOUTH], listed: [] });
    assert.equal(s.kind, "select");
    assert.deepEqual(s.kind === "select" && s.items.map((i) => i.value), ["1", "2"]);
  });

  test("a deactivated own branch is not offered once the list loads", () => {
    const s = workingBranchSelector({ viewAll: false, own: [NORTH, SOUTH, EAST], listed: [NORTH, SOUTH] });
    assert.deepEqual(s.kind === "select" && s.items.map((i) => i.value), ["1", "2"]);
  });

  test("one branch: plain text", () => {
    assert.deepEqual(workingBranchSelector({ viewAll: false, own: [SOUTH], listed: LISTED }), {
      kind: "single",
      branch: SOUTH,
    });
  });

  test("no branch and no view_all: nothing", () => {
    assert.deepEqual(workingBranchSelector({ viewAll: false, own: [], listed: LISTED }), { kind: "none" });
  });

  test("the select's value: the working branch, else All branches (view_all) or nothing picked", () => {
    assert.equal(workingBranchSelectorValue(2, true), "2");
    assert.equal(workingBranchSelectorValue(null, true), ALL_BRANCHES);
    assert.equal(workingBranchSelectorValue(2, false), "2");
    assert.equal(workingBranchSelectorValue(null, false), null);
  });

  test("viewers used above are what the auth store would build", () => {
    assert.deepEqual(oneBranch.branchIds, [2]);
  });
});

describe("branch-scoped filter objects (Reminders, Applications)", () => {
  type F = { status?: string; branch_id?: number };
  const start = initialBranchFilters<F>({ status: "pending" });

  test("never picked: the branch follows the working branch, other filters kept", () => {
    assert.deepEqual(shownBranchFilters(start, 2), { status: "pending", branch_id: 2 });
    assert.deepEqual(shownBranchFilters(start, null), { status: "pending" });
  });

  test("changing another filter keeps following", () => {
    const s = nextBranchFilters(start, { status: "sent", branch_id: 2 }, 2);
    assert.deepEqual(shownBranchFilters(s, 3), { status: "sent", branch_id: 3 });
  });

  test("a branch picked on the page holds while the working branch stays", () => {
    const s = nextBranchFilters(start, { status: "pending", branch_id: 1 }, 2);
    assert.deepEqual(shownBranchFilters(s, 2), { status: "pending", branch_id: 1 });
  });

  test("picking every branch on the page holds too", () => {
    const s = nextBranchFilters(start, { status: "pending" }, 2);
    assert.deepEqual(shownBranchFilters(s, 2), { status: "pending" });
  });

  test("a header switch overrides the page's pick, and other filters stay", () => {
    const picked = nextBranchFilters(start, { status: "sent", branch_id: 1 }, 2);
    assert.deepEqual(shownBranchFilters(picked, 3), { status: "sent", branch_id: 3 });
    const after = nextBranchFilters(picked, { status: "failed", branch_id: 3 }, 3);
    assert.deepEqual(shownBranchFilters(after, 3), { status: "failed", branch_id: 3 });
  });

  test("flag off (no working branch): exactly today's filters", () => {
    const s = nextBranchFilters(start, { status: "pending", branch_id: 1 }, null);
    assert.deepEqual(shownBranchFilters(s, null), { status: "pending", branch_id: 1 });
    const cleared = nextBranchFilters(s, { status: "pending" }, null);
    assert.deepEqual(shownBranchFilters(cleared, null), { status: "pending" });
  });
});
