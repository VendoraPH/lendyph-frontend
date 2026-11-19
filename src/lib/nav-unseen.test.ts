import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SEEN_LIMIT,
  UNSEEN_MAX_AGE_MS,
  countUnseen,
  isUnderPath,
  mergeSeen,
  navTargetFor,
  notificationPath,
  sanitizeSeen,
  unseenFeedAction,
  viewedAt,
} from "./nav-unseen";

const NAV = [
  { href: "/dashboard" },
  { href: "/loans", children: [{ href: "/loans" }, { href: "/loans/restructure" }] },
  {
    href: "/savings",
    children: [{ href: "/savings" }, { href: "/savings/approvals" }, { href: "/savings/dashboard" }],
  },
  { href: "/member-portal", children: [{ href: "/member-portal/requests" }] },
];

const row = (id: string, url: string | null) => ({ id, url });

describe("notificationPath", () => {
  it("keeps the path and drops query, hash and a trailing slash", () => {
    assert.equal(notificationPath("/loans/12?tab=approval#step"), "/loans/12");
    assert.equal(notificationPath("/loans/"), "/loans");
  });

  it("refuses what isn't an in-app path", () => {
    assert.equal(notificationPath(null), null);
    assert.equal(notificationPath("https://evil.example/loans"), null);
    assert.equal(notificationPath("//evil.example"), null);
    assert.equal(notificationPath("/"), null);
  });
});

describe("isUnderPath", () => {
  it("matches the base and the pages below it only", () => {
    assert.equal(isUnderPath("/loans", "/loans"), true);
    assert.equal(isUnderPath("/loans/12", "/loans"), true);
    assert.equal(isUnderPath("/loansx", "/loans"), false);
    assert.equal(isUnderPath("/loans", "/"), false);
  });
});

describe("navTargetFor", () => {
  it("picks the longest matching entry, child first on a tie", () => {
    assert.deepEqual(navTargetFor("/loans/12", NAV), { item: "/loans", child: "/loans" });
    assert.deepEqual(navTargetFor("/savings/approvals/4", NAV), {
      item: "/savings",
      child: "/savings/approvals",
    });
    assert.deepEqual(navTargetFor("/member-portal/requests/9", NAV), {
      item: "/member-portal",
      child: "/member-portal/requests",
    });
  });

  it("is the section alone when no child covers the path", () => {
    assert.deepEqual(navTargetFor("/member-portal/other", NAV), { item: "/member-portal", child: null });
    assert.deepEqual(navTargetFor("/dashboard", NAV), { item: "/dashboard", child: null });
  });

  it("is null outside every entry", () => {
    assert.equal(navTargetFor("/cda/capr", NAV), null);
  });
});

describe("viewedAt", () => {
  const rows = [row("a", "/loans/12"), row("b", "/loans/13"), row("c", "/savings/approvals/4")];

  it("is the page's own notification", () => {
    assert.deepEqual(viewedAt(rows, "/loans/12", NAV), ["a"]);
  });

  it("covers every notification below a list page", () => {
    assert.deepEqual(viewedAt(rows, "/loans", NAV), ["a", "b"]);
  });

  it("is nothing on an unrelated page", () => {
    assert.deepEqual(viewedAt(rows, "/savings/dashboard", NAV), []);
    assert.deepEqual(viewedAt(rows, "/dashboard", NAV), []);
  });

  it("is nothing on another menu link's page, even one above it", () => {
    // The badge sits on "Savings Approvals" and "Restructure"; the accounts
    // list and the loans list don't show those, so they don't clear them.
    const more = [...rows, row("d", "/loans/restructure/2")];
    assert.deepEqual(viewedAt(more, "/savings", NAV), []);
    assert.deepEqual(viewedAt(more, "/loans", NAV), ["a", "b"]);
    assert.deepEqual(viewedAt(more, "/loans/restructure", NAV), ["d"]);
  });
});

describe("countUnseen", () => {
  const rows = [
    row("a", "/loans/12"),
    row("b", "/loans/13"),
    row("c", "/loans/restructure/2"),
    row("d", "/savings/approvals/4"),
    row("e", null),
    row("f", "/cda/capr"),
  ];

  it("counts per section and per child link", () => {
    const counts = countUnseen(rows, NAV, new Set(), "/dashboard");
    assert.deepEqual(counts.items, { "/loans": 3, "/savings": 1 });
    assert.deepEqual(counts.children, { "/loans": 2, "/loans/restructure": 1, "/savings/approvals": 1 });
  });

  it("leaves out seen ones and those the open page shows", () => {
    const counts = countUnseen(rows, NAV, new Set(["d"]), "/loans/12");
    assert.deepEqual(counts.items, { "/loans": 2 });
    assert.deepEqual(counts.children, { "/loans": 1, "/loans/restructure": 1 });
  });

  it("counts each notification under one section only", () => {
    const counts = countUnseen(rows, NAV, new Set(), "/dashboard");
    const total = Object.values(counts.items).reduce((sum, n) => sum + n, 0);
    assert.equal(total, 4);
  });

  it("leaves out a page the user can't open, without falling back to its section", () => {
    const noRestructure = (_item: string, child: string | null) => child !== "/loans/restructure";
    const counts = countUnseen(rows, NAV, new Set(), "/dashboard", noRestructure);
    assert.deepEqual(counts.items, { "/loans": 2, "/savings": 1 });
    assert.deepEqual(counts.children, { "/loans": 2, "/savings/approvals": 1 });

    const noSavings = (item: string) => item !== "/savings";
    assert.deepEqual(countUnseen(rows, NAV, new Set(), "/dashboard", noSavings).items, { "/loans": 3 });
  });
});

describe("unseenFeedAction", () => {
  const last = { owner: "7", count: 3, at: 1_000 };

  it("reads the list when the bell's count moved, or for another user", () => {
    assert.equal(unseenFeedAction(null, "7", 3, 2_000), "read");
    assert.equal(unseenFeedAction(last, "7", 4, 2_000), "read");
    assert.equal(unseenFeedAction(last, "8", 3, 2_000), "read");
  });

  it("keeps the list while the count holds, until it is 5 minutes old", () => {
    assert.equal(unseenFeedAction(last, "7", 3, 1_000 + UNSEEN_MAX_AGE_MS - 1), "keep");
    assert.equal(unseenFeedAction(last, "7", 3, 1_000 + UNSEEN_MAX_AGE_MS), "read");
  });

  it("needs no read at all with nothing unread", () => {
    assert.equal(unseenFeedAction(last, "7", 0, 2_000), "empty");
    assert.equal(unseenFeedAction({ owner: "7", count: 0, at: 1_000 }, "7", 0, 2_000), "keep");
  });
});

describe("sanitizeSeen", () => {
  it("keeps string ids per user, capped, and drops everything else", () => {
    const many = Array.from({ length: SEEN_LIMIT + 2 }, (_, i) => `id${i}`);
    assert.deepEqual(
      sanitizeSeen({ "7": ["a", 3, null, "b"], "8": "oops", "9": many, "10": { text: "x" } }),
      { "7": ["a", "b"], "9": many.slice(2) },
    );
  });

  it("is empty for anything that isn't a map of users", () => {
    assert.deepEqual(sanitizeSeen(undefined), {});
    assert.deepEqual(sanitizeSeen("x"), {});
    assert.deepEqual(sanitizeSeen(["a"]), {});
  });
});

describe("mergeSeen", () => {
  it("adds the viewed ids once and drops ones no longer unread", () => {
    assert.deepEqual(mergeSeen(["a", "b"], ["b", "c"], new Set(["b", "c"])), ["b", "c"]);
  });

  it("keeps everything when the unread list is unknown", () => {
    assert.deepEqual(mergeSeen(["a"], ["b"]), ["a", "b"]);
  });

  it("keeps only the newest ids past the cap", () => {
    const many = Array.from({ length: SEEN_LIMIT }, (_, i) => `id${i}`);
    const merged = mergeSeen(many, ["new"]);
    assert.equal(merged.length, SEEN_LIMIT);
    assert.equal(merged[0], "id1");
    assert.equal(merged.at(-1), "new");
  });
});
