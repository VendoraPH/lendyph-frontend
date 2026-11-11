import { test } from "node:test";
import assert from "node:assert/strict";
import { linesMatching, memberSources } from "./sources";

// The member's token, and the member store, live in sessionStorage only
// (portal design §1). Nothing in the portal touches localStorage, where the
// staff app keeps its token, and the portal client never reads the staff
// token or sends the staff client's requests.
const FILES = memberSources();

for (const { file, text } of FILES) {
  test(`${file} never touches localStorage or the staff token`, () => {
    assert.deepEqual(linesMatching(text, /\blocalStorage\b/), [], "localStorage");
    assert.deepEqual(linesMatching(text, /\btokenManager\b|env\.auth\.tokenKey|lendy_access_token|useAuthStore/), [], "the staff token or store");
  });
}

test("no portal source uses the staff HTTP clients", () => {
  for (const { file, text } of FILES) {
    assert.doesNotMatch(text, /from\s+["']@\/lib\/(?:axios-client|api-client)["']/, file);
    assert.doesNotMatch(text, /from\s+["']@\/services(?:\/[^"']*)?["']/, file);
  }
});

test("the portal client and the member store use sessionStorage", () => {
  const client = memberSources(["lib/portal/portal-client.ts"])[0].text;
  assert.match(client, /typeof sessionStorage === "undefined" \? null : sessionStorage/);
  assert.match(client, /PORTAL_TOKEN_KEY = "lendy_member_token"/);
  const store = memberSources(["lib/portal/portal-session.ts"])[0].text;
  assert.match(store, /storage: createJSONStorage\(\(\) => sessionStorage\)/);
});

test("the member store holds no money", () => {
  const store = memberSources(["lib/portal/portal-session.ts"])[0].text;
  assert.deepEqual(linesMatching(store, /balance|amount|outstanding|withdrawable|paid_up/i), []);
});
