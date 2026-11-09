import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "@/config/env";
import { SIDEBAR_NAV } from "./navigation";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const LAYOUT = "src/app/(app)/credit-scoring/layout.tsx";

test("Credit Scoring is off when the flag isn't set", () => {
  assert.equal(env.features.creditScoring, false);
  assert.equal(SIDEBAR_NAV.some((item) => item.href === "/credit-scoring"), false);
});

test("the flag is read literally, so Next inlines it into the browser bundle", () => {
  assert.match(read("src/config/env.ts"), /process\.env\.NEXT_PUBLIC_ENABLE_CREDIT_SCORING/);
});

test("every Credit Scoring route answers not found while the flag is off", () => {
  assert.equal(existsSync(resolve(process.cwd(), LAYOUT)), true);
  const layout = read(LAYOUT);
  assert.match(layout, /env\.features\.creditScoring/);
  assert.match(layout, /notFound\(\)/);
  assert.doesNotMatch(layout, /"use client"/);
});

test(".env.example documents the flag, off", () => {
  assert.match(read(".env.example"), /^NEXT_PUBLIC_ENABLE_CREDIT_SCORING=false$/m);
});

test("Opening Balances sits under Accounting, after Period Closing, for accounting:settings", () => {
  const accounting = SIDEBAR_NAV.find((item) => item.href === "/accounting");
  assert.ok(accounting?.children, "Accounting has children");
  const hrefs = accounting.children.map((child) => child.href);
  const at = hrefs.indexOf("/accounting/opening-balances");
  assert.equal(hrefs[at - 1], "/accounting/period-closing");
  assert.deepEqual(accounting.children[at], {
    title: "Opening Balances",
    href: "/accounting/opening-balances",
    permission: "accounting:settings",
  });
});

test("Allowance for Credit Losses sits under Accounting, after Opening Balances, for accounting:view", () => {
  const accounting = SIDEBAR_NAV.find((item) => item.href === "/accounting");
  assert.ok(accounting?.children, "Accounting has children");
  const hrefs = accounting.children.map((child) => child.href);
  const at = hrefs.indexOf("/accounting/allowance");
  assert.equal(hrefs[at - 1], "/accounting/opening-balances");
  assert.deepEqual(accounting.children[at], {
    title: "Allowance for Credit Losses",
    href: "/accounting/allowance",
    permission: "accounting:view",
  });
});

test("the Allowance for Credit Losses page exists and opens on accounting:view", () => {
  const page = read("src/app/(app)/accounting/allowance/page.tsx");
  assert.match(page, /<RouteGuard permission="accounting:view"/);
});
