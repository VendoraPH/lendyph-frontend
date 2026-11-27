/**
 * The Linda menu item with NEXT_PUBLIC_ENABLE_LINDA on. The flag is read when
 * `@/config/env` loads, so it is set before the menu is imported; each test
 * file runs in its own process, so it goes no further than this file. The
 * flag-off case is in navigation.test.ts.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let nav: typeof import("./navigation");

before(async () => {
  process.env.NEXT_PUBLIC_ENABLE_LINDA = "true";
  nav = await import("./navigation");
});

const holds = (...held: string[]) => (p: string) => held.includes(p);
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("with the flag on, Linda sits in the menu right after Dashboard", () => {
  assert.equal(nav.SIDEBAR_NAV[0].href, "/dashboard");
  assert.equal(nav.SIDEBAR_NAV[1], nav.LINDA_NAV);
  assert.equal(nav.LINDA_NAV.title, "Linda");
  assert.equal(nav.LINDA_NAV.href, "/linda");
  assert.equal(nav.LINDA_NAV.children, undefined);
});

test("the Linda menu item needs linda:use, as its page and the server do", () => {
  assert.equal(nav.LINDA_NAV.permission, "linda:use");
  assert.equal(nav.navItemAllowed(nav.LINDA_NAV, holds()), false);
  assert.equal(nav.navItemAllowed(nav.LINDA_NAV, holds("linda:settings")), false);
  assert.equal(nav.navItemAllowed(nav.LINDA_NAV, holds("linda:use")), true);
});

test("/linda answers not found with the flag off and guards on linda:use", () => {
  const layout = read("src/app/(app)/linda/layout.tsx");
  assert.match(layout, /if \(!env\.features\.linda\) notFound\(\);/);
  assert.doesNotMatch(layout, /"use client"/);
  const page = read("src/app/(app)/linda/page.tsx");
  assert.match(page, /<RouteGuard permission="linda:use"/);
  assert.match(page, /<PageFill/);
  assert.match(page, /ScrollBox|LindaConversation/);
});
