import { test } from "node:test";
import assert from "node:assert/strict";
import { portalAuthMessage } from "./auth-errors";

const http = (status: number) => ({ isAxiosError: true, response: { status, data: {} } });

test("sign-in never says which part was wrong", () => {
  assert.equal(portalAuthMessage(http(401), "login"), portalAuthMessage(http(404), "login"));
});

test("lockout, rate limit and not built read as such", () => {
  assert.match(portalAuthMessage(http(423), "login"), /locked/);
  assert.match(portalAuthMessage(http(429), "otp"), /Too many/);
  assert.match(portalAuthMessage(http(501), "verify"), /not available yet/);
});

test("a bad code asks for a new one", () => {
  assert.match(portalAuthMessage(http(422), "otp"), /expired/);
});
