import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SEEN_LIMIT,
  countUnseen,
  isUnderPath,
  mergeSeen,
  navTargetFor,
  notificationPath,
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
    assert.deepEqual(viewedAt(rows, "/loans/12"), ["a"]);
  });

  it("covers every notification below a list page", () => {
    assert.deepEqual(viewedAt(rows, "/loans"), ["a", "b"]);
  });

  it("is nothing on an unrelated page", () => {
    assert.deepEqual(viewedAt(rows, "/savings/dashboard"), []);
    assert.deepEqual(viewedAt(rows, "/dashboard"), []);
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
