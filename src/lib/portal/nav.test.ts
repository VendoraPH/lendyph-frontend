import { test } from "node:test";
import assert from "node:assert/strict";
import { PORTAL_NAV, isActivePath, visibleNav } from "./nav";

test("every page shows while the server lists no switches", () => {
  assert.equal(visibleNav({}).length, PORTAL_NAV.length);
});

test("a part the cooperative switched off leaves the menu", () => {
  const hrefs = visibleNav({ loans: false, documents: false, announcements: false }).map((i) => i.href);
  assert.ok(!hrefs.includes("/member/loans"));
  assert.ok(!hrefs.includes("/member/payments"));
  assert.ok(!hrefs.includes("/member/documents"));
  assert.ok(!hrefs.includes("/member/announcements"));
  assert.ok(hrefs.includes("/member/requests"));
});

test("savings stays while either savings or time deposits is on", () => {
  assert.ok(visibleNav({ savings: false }).some((i) => i.href === "/member/savings"));
  assert.ok(!visibleNav({ savings: false, time_deposits: false }).some((i) => i.href === "/member/savings"));
});

test("every menu link stays inside /member, with four phone tabs", () => {
  for (const item of PORTAL_NAV) assert.ok(item.href === "/member" || item.href.startsWith("/member/"), item.href);
  assert.equal(PORTAL_NAV.filter((i) => i.tab).length, 4);
});

test("Home is active only on itself; other pages on their own paths", () => {
  assert.equal(isActivePath("/member", "/member"), true);
  assert.equal(isActivePath("/member/loans", "/member"), false);
  assert.equal(isActivePath("/member/loans/3", "/member/loans"), true);
  assert.equal(isActivePath("/member/loansx", "/member/loans"), false);
});
