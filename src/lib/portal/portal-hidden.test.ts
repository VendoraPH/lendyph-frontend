/**
 * Menu Visibility can hide the Member Portal (finish run round 6). Its API then
 * answers 404 everywhere, its public config included, and the portal says it
 * isn't available instead of showing an error.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { portalErrorMessage } from "./errors";
import { PORTAL_HIDDEN_WORDS, configAnswerHidden, hiddenPortalConfig, markPortalHidden, portalHidden, resetPortalHidden } from "./portal-hidden";

const http = (status: number, data: unknown) => ({ response: { status, data } });
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("the words are the task's", () => {
  assert.equal(PORTAL_HIDDEN_WORDS, "The member portal isn't available right now.");
});

test("only a 404 from the config means the portal is hidden", () => {
  assert.equal(configAnswerHidden(http(404, { message: "Not found." })), true);
  assert.equal(configAnswerHidden(http(500, {})), false);
  assert.equal(configAnswerHidden(new Error("offline")), false);
});

test("a hidden portal's config is switched off, so the sign-in page shows its 'not available' state", () => {
  const config = hiddenPortalConfig();
  assert.equal(config.enabled, false);
  assert.ok(config.password_rules);
});

test("once the portal is known hidden, a 404 reads 'not available'; before, it reads as a missing record", () => {
  resetPortalHidden();
  assert.match(portalErrorMessage(http(404, { message: "Not found." }), "f"), /isn't yours/);
  markPortalHidden();
  assert.equal(portalHidden(), true);
  assert.equal(portalErrorMessage(http(404, { message: "Not found." }), "f"), PORTAL_HIDDEN_WORDS);
  assert.notEqual(portalErrorMessage(http(422, { message: "Bad." }), "f"), PORTAL_HIDDEN_WORDS);
  resetPortalHidden();
});

test("the config provider and the client check for a hidden portal", () => {
  assert.match(read("src/components/portal/portal-config.tsx"), /configAnswerHidden\(err\)/);
  const client = read("src/lib/portal/portal-client.ts");
  assert.match(client, /status === 404/);
  assert.match(client, /endPortalSession\(PORTAL_HIDDEN_WORDS\)/);
});
