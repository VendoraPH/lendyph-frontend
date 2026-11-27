import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SRC, memberSources } from "./sources";

const page = (file: string) => memberSources([file])[0].text;

test("the sign-in page reminds members on a shared computer to sign out", () => {
  assert.match(page("app/member/(auth)/login/page.tsx"), /Using a shared computer\? Sign out when you&apos;re done\./);
});

test("both sign-out buttons clear the tab at once and wait while the call runs", () => {
  for (const file of ["components/portal/portal-shell.tsx", "app/member/(signed-in)/terms/page.tsx"]) {
    const text = page(file);
    assert.match(text, /signOutMember\(signOut\)/, file);
    assert.match(text, /disabled=\{[^}]*signingOut/, file);
    assert.doesNotMatch(text, /portalService\s*\.logout\(\)/, file);
  }
});

// The shared password field: "Show password" turns it into a text field, which
// spellcheck and autocorrect services may read. Helps the staff app too.
test("the password field is never spellchecked, autocorrected or capitalised", () => {
  const field = readFileSync(join(SRC, "components/ui/password-input.tsx"), "utf8");
  assert.match(field, /spellCheck=\{false\}/);
  assert.match(field, /autoCorrect="off"/);
  assert.match(field, /autoCapitalize="none"/);
});
