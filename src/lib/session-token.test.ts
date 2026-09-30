import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bearerToken,
  isSessionRejection,
  isRenewalDue,
  isTokenExpired,
  parseTokenLifetime,
  tokenLifetime,
  unauthorizedOutcome,
} from "./session-token";

const MIN = 60 * 1000;
const T0 = Date.UTC(2026, 8, 30, 1, 0, 0);

// ── tokenLifetime ──

test("expires_in is seconds from when the response arrived", () => {
  assert.deepEqual(tokenLifetime(1800, T0, 30), { issuedAt: T0, expiresAt: T0 + 30 * MIN });
});

test("an API that sends no expires_in falls back to the configured minutes", () => {
  assert.deepEqual(tokenLifetime(undefined, T0, 30), { issuedAt: T0, expiresAt: T0 + 30 * MIN });
  assert.deepEqual(tokenLifetime("1800", T0, 30), { issuedAt: T0, expiresAt: T0 + 30 * MIN });
  assert.deepEqual(tokenLifetime(0, T0, 30), { issuedAt: T0, expiresAt: T0 + 30 * MIN });
});

// ── parseTokenLifetime ──

test("a stored lifetime round-trips", () => {
  const lifetime = tokenLifetime(1800, T0, 30);
  assert.deepEqual(parseTokenLifetime(JSON.stringify(lifetime)), lifetime);
});

test("a missing or garbled lifetime is unknown, not expired", () => {
  assert.equal(parseTokenLifetime(null), null);
  assert.equal(parseTokenLifetime("not json"), null);
  assert.equal(parseTokenLifetime('{"issuedAt":"x"}'), null);
  assert.equal(isTokenExpired(null, T0 + 999 * MIN), false);
});

// ── isTokenExpired ──

test("a token is expired from its expiry onwards", () => {
  const lifetime = tokenLifetime(1800, T0, 30);
  assert.equal(isTokenExpired(lifetime, T0 + 29 * MIN), false);
  assert.equal(isTokenExpired(lifetime, T0 + 30 * MIN), true);
});

// ── isRenewalDue ──

test("not due before half-life, however active the user is", () => {
  const lifetime = tokenLifetime(1800, T0, 30);
  assert.equal(isRenewalDue(lifetime, T0 + 14 * MIN, T0 + 14 * MIN), false);
});

test("due past half-life when the user has been active since the token was issued", () => {
  const lifetime = tokenLifetime(1800, T0, 30);
  assert.equal(isRenewalDue(lifetime, T0 + 2 * MIN, T0 + 15 * MIN), true);
  assert.equal(isRenewalDue(lifetime, T0 + 20 * MIN, T0 + 20 * MIN), true);
});

test("not due for a user idle since the token was issued (the idle timeout ends it first)", () => {
  const lifetime = tokenLifetime(1800, T0, 30);
  assert.equal(isRenewalDue(lifetime, T0 - 1 * MIN, T0 + 20 * MIN), false);
});

test("never due once expired: refreshing a dead token can only 401", () => {
  const lifetime = tokenLifetime(1800, T0, 30);
  assert.equal(isRenewalDue(lifetime, T0 + 29 * MIN, T0 + 31 * MIN), false);
});

test("never due for an unknown lifetime", () => {
  assert.equal(isRenewalDue(null, T0, T0), false);
});

// The invariant the renewal rule exists for: after any renewal it triggers,
// the new token outlives the idle deadline that follows the user's last action.
test("a renewed token always outlives the idle deadline", () => {
  const idle = 30 * MIN;
  const lifetime = tokenLifetime(1800, T0, 30);
  for (let active = 1; active < 30; active++) {
    for (let now = 15; now < 30; now++) {
      const lastActivity = T0 + Math.min(active, now) * MIN;
      if (!isRenewalDue(lifetime, lastActivity, T0 + now * MIN)) continue;
      const renewed = tokenLifetime(1800, T0 + now * MIN, 30);
      assert.ok(renewed.expiresAt >= lastActivity + idle);
    }
  }
});

// ── bearerToken ──

test("the token is read out of a Bearer header", () => {
  assert.equal(bearerToken("Bearer 12|abc"), "12|abc");
  assert.equal(bearerToken(undefined), null);
  assert.equal(bearerToken("Basic xyz"), null);
});

// ── unauthorizedOutcome ──

test("a 401 on a token that has since been rotated is replayed with the current one", () => {
  assert.equal(unauthorizedOutcome("12|old", "13|new"), "replay");
});

test("a 401 on the current token ends the session, with no refresh attempt", () => {
  assert.equal(unauthorizedOutcome("12|old", "12|old"), "session-over");
});

test("a 401 after the tokens were cleared ends the session", () => {
  assert.equal(unauthorizedOutcome("12|old", null), "session-over");
});

// ── isSessionRejection ──

test("only a refused token is a rejected session", () => {
  for (const status of [401, 403, 419]) assert.equal(isSessionRejection(status), true);
});

test("a throttle, a server error or no response at all is not a logout", () => {
  for (const status of [429, 500, 502, 503, undefined]) assert.equal(isSessionRejection(status), false);
});
