/**
 * The Executive Dashboard stays behind NEXT_PUBLIC_ENABLE_EXECUTIVE_DASHBOARD,
 * off by default, like Credit Scoring and Linda. Read from source: layouts and
 * pages are components, which `tsx --test` doesn't render.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("the flag is read literally, so Next inlines it into the browser bundle", () => {
  assert.match(
    read("src/config/env.ts"),
    /executiveDashboard: parseBoolEnvValue\(process\.env\.NEXT_PUBLIC_ENABLE_EXECUTIVE_DASHBOARD\)/,
  );
});

test("the flag is documented in .env.example and off there", () => {
  assert.match(read(".env.example"), /^NEXT_PUBLIC_ENABLE_EXECUTIVE_DASHBOARD=false$/m);
});

test("a direct URL answers not found while the flag is off", () => {
  const layout = read("src/app/(app)/dashboard/executive/layout.tsx");
  assert.match(layout, /if \(!env\.features\.executiveDashboard\) notFound\(\);/);
});

test("the Dashboard links to it only while the flag is on", () => {
  const page = read("src/app/(app)/dashboard/page.tsx");
  assert.match(page, /\{env\.features\.executiveDashboard \? \(\s*<div className="flex shrink-0 justify-end">\s*<Link\s+href="\/dashboard\/executive"/);
});

test("a card's tooltip shows its API source in development builds only", () => {
  const card = read("src/app/(app)/dashboard/executive/_components/kpi-card.tsx");
  assert.match(card, /process\.env\.NODE_ENV === "development" \? \(\s*<p className="mt-1 font-mono text-\[10px\] opacity-80">\{m\.source\}<\/p>/);
});

test("the page fits the screen: sections scroll inside their own box, full width", () => {
  const page = read("src/app/(app)/dashboard/executive/page.tsx");
  assert.match(page, /<PageFill className="gap-4">/);
  assert.match(page, /<ScrollBox className=\{L\.scrollBox\}>/);
  assert.doesNotMatch(page, /max-w-\[/);
  // Only the header and filter bar stay pinned: the KPI cards scroll with the sections.
  assert.ok(page.indexOf("<ScrollBox ") < page.indexOf("kpis.map("), "the KPI cards are inside the scroll box");
});
