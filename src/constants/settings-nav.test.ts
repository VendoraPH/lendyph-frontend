/**
 * Every module's settings sit under Settings (ClickUp 14zfbg0e7md), not in the
 * module's own menu. Flags are off under test, so only Accounting is built in;
 * the flag-gated entries are checked from source.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Permission } from "@/types";
import { MODULE_SETTINGS_NAV, SIDEBAR_NAV, navChildAllowed, navItemAllowed, navItemHref } from "./navigation";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const holds = (...keys: Permission[]) => (permission: Permission) => keys.includes(permission);
const settings = () => {
  const section = SIDEBAR_NAV.find((item) => item.href === "/settings");
  assert.ok(section);
  return section;
};

const MOVED: [old: string, now: string, page: string, layoutOf?: string][] = [
  ["/accounting/settings", "/settings/accounting", "src/app/(app)/settings/accounting/page.tsx"],
  ["/cda/settings", "/settings/cda", "src/app/(app)/settings/cda/page.tsx", "cda"],
  ["/credit-scoring/settings", "/settings/credit-scoring", "src/app/(app)/settings/credit-scoring/page.tsx", "credit-scoring"],
  ["/credit-scoring/scorecard-configuration", "/settings/scorecard-configuration", "src/app/(app)/settings/scorecard-configuration/page.tsx", "credit-scoring"],
  ["/savings/settings", "/settings/savings", "src/app/(app)/settings/savings/page.tsx", "savings"],
  ["/savings/products", "/settings/savings-products", "src/app/(app)/settings/savings-products/page.tsx", "savings"],
];

test("no module menu lists a settings page any more; Settings lists Accounting's", () => {
  for (const item of SIDEBAR_NAV) {
    if (item.href === "/settings") continue;
    for (const child of item.children ?? []) {
      assert.equal(MOVED.some(([old]) => child.href === old), false, child.href);
    }
  }
  const hrefs = (settings().children ?? []).map((child) => child.href);
  assert.ok(hrefs.includes("/settings/accounting"));
  assert.ok(hrefs.indexOf("/settings/accounting") < hrefs.indexOf("/settings/data-import"));
});

test("each moved page lives under /settings, keeps its module's flag gate, and its old URL redirects", () => {
  const config = read("next.config.ts");
  for (const [old, now, page, module] of MOVED) {
    assert.equal(existsSync(resolve(process.cwd(), page)), true, page);
    assert.ok(config.includes(`["${old}", "${now}"]`), old);
    if (module) {
      const layout = read(page.replace("page.tsx", "layout.tsx"));
      assert.match(layout, new RegExp(`export \\{ default \\} from "@/app/\\(app\\)/${module}/layout"`));
    }
  }
});

test("each moved page is titled with its Settings menu name, not its old module path", () => {
  const titled: [file: string, words: string[]][] = [
    ["src/app/(app)/settings/accounting/page.tsx", ['title="Accounting"', 'pageName="Accounting"']],
    ["src/app/(app)/settings/cda/page.tsx", ['title="CDA"']],
    ["src/app/(app)/settings/credit-scoring/page.tsx", ['title="Credit Scoring"', 'pageName="Credit Scoring"']],
    ["src/app/(app)/settings/savings/page.tsx", ['pageName="Savings"']],
    ["src/app/(app)/settings/savings/_components/settings-screen.tsx", [">Savings</h1>"]],
  ];
  for (const [file, words] of titled) {
    const page = read(file);
    for (const word of words) assert.ok(page.includes(word), `${file}: ${word}`);
  }
});

test("the flag-gated entries are built only with their module's flag", () => {
  const nav = read("src/constants/navigation.ts");
  assert.match(nav, /env\.features\.savings\s*\?\s*\[\s*\{ title: "Savings Products", href: "\/settings\/savings-products"/);
  assert.match(nav, /env\.features\.cda\s*\?\s*\[\{ title: "CDA", href: "\/settings\/cda"/);
  assert.match(nav, /env\.features\.creditScoring\s*\?\s*\[\s*\{ title: "Scorecard Configuration", href: "\/settings\/scorecard-configuration"/);
});

test("an accountant with only accounting:settings sees Settings with just the Accounting page", () => {
  const can = holds("accounting:settings");
  assert.equal(navItemAllowed(settings(), can), true);
  const visible = (settings().children ?? []).filter((child) => navChildAllowed(child, can)).map((c) => c.href);
  assert.deepEqual(visible, ["/settings/accounting"]);
  assert.equal(navItemHref(settings(), can), "/settings/accounting");
});

test("settings:view still opens the general pages but not a module's settings", () => {
  const can = holds("settings:view");
  assert.equal(navItemAllowed(settings(), can), true);
  const visible = (settings().children ?? []).filter((child) => navChildAllowed(child, can)).map((c) => c.href);
  assert.ok(visible.includes("/settings/profile"));
  assert.ok(visible.includes("/settings/gcash"));
  assert.equal(visible.includes("/settings/accounting"), false);
  assert.equal(navItemHref(settings(), can), "/settings/profile");
});

test("no one without a settings key sees Settings", () => {
  assert.equal(navItemAllowed(settings(), holds("accounting:view", "savings:view")), false);
});

test("every Settings page names its permission, since the section opens on several", () => {
  for (const child of settings().children ?? []) assert.ok(child.permission, child.href);
  for (const child of MODULE_SETTINGS_NAV) assert.ok(child.permission, child.href);
});
