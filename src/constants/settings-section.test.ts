/**
 * Who sees Settings, with every module's flag on: the section opens for anyone
 * who can open one of its pages, each by that page's own gate, and lists only
 * those pages. The flags are read when `@/config/env` loads, so they are set
 * before the menu is imported; each test file runs in its own process, so they
 * go no further than this file. The flag-off cases are in settings-nav.test.ts.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import type { Permission } from "@/types";

let nav: typeof import("./navigation");

before(async () => {
  process.env.NEXT_PUBLIC_ENABLE_PENALTY_CONFIGS = "true";
  process.env.NEXT_PUBLIC_ENABLE_MEMBER_PORTAL = "true";
  process.env.NEXT_PUBLIC_ENABLE_LINDA = "true";
  process.env.NEXT_PUBLIC_ENABLE_AMLA = "true";
  process.env.NEXT_PUBLIC_ENABLE_SAVINGS = "true";
  process.env.NEXT_PUBLIC_ENABLE_CDA = "true";
  process.env.NEXT_PUBLIC_ENABLE_CREDIT_SCORING = "true";
  process.env.NEXT_PUBLIC_ENABLE_CIC = "true";
  nav = await import("./navigation");
});

const holds = (...keys: Permission[]) => (permission: Permission) => keys.includes(permission);
const settings = () => {
  const section = nav.SIDEBAR_NAV.find((item) => item.href === "/settings");
  assert.ok(section);
  return section;
};
const visible = (can: (permission: Permission) => boolean) =>
  (settings().children ?? []).filter((child) => nav.navChildAllowed(child, can)).map((child) => child.href);

test("a role holding only one page's permission sees Settings with just that page, and its link goes there", () => {
  const cases: [Permission[], string][] = [
    [["fees:view"], "/settings/fees"],
    [["penalties:view"], "/settings/penalties"],
    // Company-wide pages keep their own gate: their key and branches:view_all.
    [["member_portal:settings", "branches:view_all"], "/settings/member-portal"],
    [["linda:settings", "branches:view_all"], "/settings/linda"],
    [["cic:settings", "branches:view_all"], "/settings/cic"],
    [["imports:process"], "/settings/data-import"],
  ];
  for (const [keys, page] of cases) {
    const can = holds(...keys);
    assert.equal(nav.navItemAllowed(settings(), can), true, keys.join(" + "));
    assert.deepEqual(visible(can), [page], keys.join(" + "));
    assert.equal(nav.navItemHref(settings(), can), page, keys.join(" + "));
  }
});

test("every Settings page opens the section for whoever passes that page's own gate", () => {
  for (const child of settings().children ?? []) {
    assert.ok(child.permission, child.href);
    const key = Array.isArray(child.permission) ? child.permission[0] : (child.permission as Permission);
    const can = holds(key, ...(child.alsoRequires ?? []));
    assert.equal(nav.navItemAllowed(settings(), can), true, child.href);
    assert.ok(visible(can).includes(child.href), child.href);
  }
});

test("a company-wide page's key without branches:view_all, or view_all alone, shows no Settings", () => {
  for (const key of ["member_portal:settings", "linda:settings", "cda:view", "cic:settings"] as Permission[]) {
    assert.equal(nav.navItemAllowed(settings(), holds(key)), false, key);
  }
  assert.equal(nav.navItemAllowed(settings(), holds("branches:view_all")), false);
  assert.equal(nav.navItemAllowed(settings(), holds("loans:view", "borrowers:view", "savings:view", "reports:view")), false);
});
