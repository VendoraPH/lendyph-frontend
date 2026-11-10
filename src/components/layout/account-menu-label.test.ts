import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { accountMenuLabel } from "./account-menu-label";

test("the account menu button is named for the signed-in user", () => {
  assert.equal(accountMenuLabel("Maria Santos"), "Account menu for Maria Santos");
  assert.equal(accountMenuLabel("  Juan dela Cruz "), "Account menu for Juan dela Cruz");
});

test("with no name yet, the button still has a name", () => {
  assert.equal(accountMenuLabel(undefined), "Account menu");
  assert.equal(accountMenuLabel(null), "Account menu");
  assert.equal(accountMenuLabel("   "), "Account menu");
});

test("the header's initials button carries that name", () => {
  const header = readFileSync(join(process.cwd(), "src/components/layout/header.tsx"), "utf8");
  assert.match(
    header,
    /<DropdownMenuTrigger\s+aria-label=\{accountMenuLabel\(user\?\.full_name\)\}/,
  );
});

test("the account menu button shows a focus ring like the app's buttons", () => {
  const header = readFileSync(join(process.cwd(), "src/components/layout/header.tsx"), "utf8");
  const trigger = header.match(/<DropdownMenuTrigger[\s\S]*?>/)?.[0] ?? "";
  assert.match(trigger, /focus-visible:ring-3 focus-visible:ring-ring\/50/);
});
