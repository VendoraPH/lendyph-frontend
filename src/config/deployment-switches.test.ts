/**
 * Accounting, Loan Reminders and Share Capital Auto-Credit are modules every
 * deployment has; one deployment (app.lendyph.com) switches them off. So they
 * are ON when unset, unlike the opt-in module flags, and production's deploy
 * sets every module that site hides to false.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const SWITCHES = [
  { feature: "accounting", name: "NEXT_PUBLIC_ENABLE_ACCOUNTING" },
  { feature: "loanReminders", name: "NEXT_PUBLIC_ENABLE_LOAN_REMINDERS" },
  { feature: "shareCapitalAutoCredit", name: "NEXT_PUBLIC_ENABLE_SHARE_CAPITAL_AUTO_CREDIT" },
] as const;

for (const { feature, name } of SWITCHES) {
  test(`${name} is read literally into env.features.${feature}, on by default`, () => {
    assert.match(
      read("src/config/env.ts"),
      new RegExp(`\\b${feature}: parseBoolEnvValue\\(process\\.env\\.${name}, true\\)`),
    );
  });

  test(`${name} is documented in .env.example and on there`, () => {
    assert.match(read(".env.example"), new RegExp(`^${name}=true$`, "m"));
  });

  test(`env.features.${feature} is on when ${name} is unset`, async () => {
    const { env } = await import("./env");
    assert.equal(env.features[feature], true);
  });
}

const HIDDEN_ON_PRODUCTION = [
  "NEXT_PUBLIC_ENABLE_LINDA",
  "NEXT_PUBLIC_ENABLE_SAVINGS",
  "NEXT_PUBLIC_ENABLE_CDA",
  "NEXT_PUBLIC_ENABLE_ACCOUNTING",
  "NEXT_PUBLIC_ENABLE_MEMBER_PORTAL",
  "NEXT_PUBLIC_ENABLE_LOAN_REMINDERS",
  "NEXT_PUBLIC_ENABLE_SHARE_CAPITAL_AUTO_CREDIT",
];

test("app.lendyph.com's deploy builds with every hidden module off", () => {
  const workflow = read(".github/workflows/deploy-production.yml");
  const buildAt = workflow.indexOf("bash /var/www/lendyph-com-frontend/deploy.sh");
  assert.ok(buildAt > -1, "deploy.sh is still the build step");
  for (const name of HIDDEN_ON_PRODUCTION) {
    const at = workflow.search(new RegExp(`^\\s*export ${name}=false$`, "m"));
    assert.ok(at > -1 && at < buildAt, `${name}=false is exported before deploy.sh builds`);
  }
});

test("each route group a switch hides has a not-found gate", () => {
  for (const [path, feature] of [
    ["src/app/(app)/accounting/layout.tsx", "accounting"],
    ["src/app/(app)/loans/reminders/layout.tsx", "loanReminders"],
    ["src/app/(app)/share-capital/auto-credit/layout.tsx", "shareCapitalAutoCredit"],
  ]) {
    assert.match(read(path), new RegExp(`if \\(!env\\.features\\.${feature}\\) notFound\\(\\);`), path);
  }
});

/**
 * The seven modules app.lendyph.com hides, each with its flag, its routes and
 * its entries under Settings. The menu is built at import time, so each case
 * builds it in a fresh process with the flags set.
 */
const MODULES = [
  { name: "NEXT_PUBLIC_ENABLE_ACCOUNTING", routes: ["/accounting"], settings: ["/settings/accounting"] },
  { name: "NEXT_PUBLIC_ENABLE_LOAN_REMINDERS", routes: ["/loans/reminders"], settings: [] },
  { name: "NEXT_PUBLIC_ENABLE_SHARE_CAPITAL_AUTO_CREDIT", routes: ["/share-capital/auto-credit"], settings: [] },
  { name: "NEXT_PUBLIC_ENABLE_LINDA", routes: ["/linda"], settings: ["/settings/linda"] },
  { name: "NEXT_PUBLIC_ENABLE_SAVINGS", routes: ["/savings"], settings: ["/settings/savings", "/settings/savings-products"] },
  { name: "NEXT_PUBLIC_ENABLE_CDA", routes: ["/cda"], settings: ["/settings/cda"] },
  { name: "NEXT_PUBLIC_ENABLE_MEMBER_PORTAL", routes: ["/member-portal"], settings: ["/settings/member-portal"] },
] as const;

interface BuiltMenu {
  hrefs: string[];
  settings: string[];
  settingsOpensOn: string[];
}

function menuBuiltWith(flags: Record<string, string>): BuiltMenu {
  const script = `import("./src/constants/navigation.ts").then(({ SIDEBAR_NAV }) => {
    const settings = SIDEBAR_NAV.find((item) => item.href === "/settings");
    process.stdout.write(JSON.stringify({
      hrefs: SIDEBAR_NAV.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]),
      settings: (settings?.children ?? []).map((child) => child.href),
      settingsOpensOn: settings?.anyOf ?? [],
    }));
  });`;
  const output = execFileSync(process.execPath, ["--import", "tsx", "-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...flags },
  });
  return JSON.parse(output) as BuiltMenu;
}

const allModules = (value: "true" | "false") =>
  Object.fromEntries(MODULES.map(({ name }) => [name, value]));
const inside = (href: string, prefix: string) => href === prefix || href.startsWith(`${prefix}/`);

test("with every hidden module off, no menu entry and no Settings page leads into one", () => {
  const menu = menuBuiltWith(allModules("false"));
  for (const { name, routes, settings } of MODULES) {
    for (const prefix of [...routes, ...settings]) {
      const shown = menu.hrefs.filter((href) => inside(href, prefix));
      assert.deepEqual(shown, [], `${name}=false still lists ${shown.join(", ")}`);
    }
  }
  assert.equal(menu.settingsOpensOn.includes("accounting:settings"), false, "accounting:settings alone opens Settings");
  assert.ok(menu.settings.includes("/settings/profile"), "the general Settings pages stay");
});

test("each module's Settings entries follow its own flag", () => {
  const on = menuBuiltWith(allModules("true"));
  for (const { name, settings } of MODULES) {
    for (const href of settings) assert.ok(on.settings.includes(href), `${name}=true lists ${href}`);
  }
  assert.ok(on.settingsOpensOn.includes("accounting:settings"));
  for (const { name, settings } of MODULES) {
    if (settings.length === 0) continue;
    const off = menuBuiltWith({ ...allModules("true"), [name]: "false" });
    for (const href of settings) assert.equal(off.settings.includes(href), false, `${name}=false lists ${href}`);
    assert.equal(off.settings.length, on.settings.length - settings.length, `${name}=false hides only its own`);
  }
});

const FLAG_FEATURE: Record<string, string> = {
  NEXT_PUBLIC_ENABLE_ACCOUNTING: "accounting",
  NEXT_PUBLIC_ENABLE_LOAN_REMINDERS: "loanReminders",
  NEXT_PUBLIC_ENABLE_SHARE_CAPITAL_AUTO_CREDIT: "shareCapitalAutoCredit",
  NEXT_PUBLIC_ENABLE_LINDA: "linda",
  NEXT_PUBLIC_ENABLE_SAVINGS: "savings",
  NEXT_PUBLIC_ENABLE_CDA: "cda",
  NEXT_PUBLIC_ENABLE_MEMBER_PORTAL: "memberPortal",
};

/** The layout a route folder renders under: its own, or the module layout it re-exports. */
function gateOf(folder: string): string {
  const own = join("src/app/(app)", folder, "layout.tsx");
  assert.ok(existsSync(join(process.cwd(), own)), `${own} exists`);
  const source = read(own);
  const reexport = source.match(/export \{ default \} from "@\/app\/\(app\)\/([^"]+)\/layout"/);
  return reexport ? read(join("src/app/(app)", reexport[1], "layout.tsx")) : source;
}

test("every hidden module's routes and settings routes answer not found while its flag is off", () => {
  for (const { name, routes, settings } of MODULES) {
    const feature = FLAG_FEATURE[name];
    for (const href of [...routes, ...settings]) {
      assert.match(gateOf(href.slice(1)), new RegExp(`if \\(!env\\.features\\.${feature}\\) notFound\\(\\);`), `${href} (${name})`);
    }
  }
  // Loan Reminders' settings are a tab inside its own route.
  assert.ok(existsSync(join(process.cwd(), "src/app/(app)/loans/reminders/settings")));
});

test("the reminder cards show only while Loan Reminders are on", () => {
  assert.match(
    read("src/app/(app)/borrowers/[id]/_components/overview-tab.tsx"),
    /\{env\.features\.loanReminders && <NotificationPreferencesCard borrowerId=\{borrower\.id\} \/>\}/,
  );
  assert.match(read("src/app/(app)/loans/[id]/page.tsx"), /env\.features\.loanReminders && <LoanRemindersCard /);
});
