/**
 * Accounting, Loan Reminders and Share Capital Auto-Credit are modules every
 * deployment has; one deployment (app.lendyph.com) switches them off. So they
 * are ON when unset, unlike the opt-in module flags, and production's deploy
 * sets every module that site hides to false.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
