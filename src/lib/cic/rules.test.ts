import assert from "node:assert/strict";
import { test } from "node:test";

import type { CicPublicKey } from "@/types/cic";
import { cicKeyProblem, defaultCicReferenceDate, isValidProviderCode } from "./rules";

const NOW = new Date("2026-11-28T04:00:00Z");
const key: CicPublicKey = {
  id: 1,
  fingerprint: "AB12",
  algorithm: "RSA 4096",
  user_id: null,
  status: "valid",
  uploaded_at: "2026-11-01T00:00:00Z",
  uploaded_by: null,
  verified_at: "2026-11-01T01:00:00Z",
  verified_by: null,
  expires_at: "2027-11-01T00:00:00Z",
};

test("the default File Reference Date is the last day of the month just closed", () => {
  assert.equal(defaultCicReferenceDate("2026-11-27"), "2026-10-31");
  assert.equal(defaultCicReferenceDate("2026-03-01"), "2026-02-28");
  assert.equal(defaultCicReferenceDate("2028-03-15"), "2028-02-29");
  assert.equal(defaultCicReferenceDate("2027-01-05"), "2026-12-31");
});

test("a provider code is exactly 8 letters or digits", () => {
  assert.equal(isValidProviderCode("TEST0001"), true);
  assert.equal(isValidProviderCode("TEST001"), false);
  assert.equal(isValidProviderCode("TEST-001"), false);
});

test("only a verified, unexpired key encrypts", () => {
  assert.equal(cicKeyProblem(key, NOW), null);
  assert.match(cicKeyProblem(null, NOW) ?? "", /Upload/);
  assert.match(cicKeyProblem({ ...key, status: "unverified", verified_at: null }, NOW) ?? "", /Verify/);
  assert.match(cicKeyProblem({ ...key, verified_at: null }, NOW) ?? "", /Verify/);
  assert.match(cicKeyProblem({ ...key, status: "expired" }, NOW) ?? "", /expired/);
});

test("a key past its expiry is refused even before the server marks it expired", () => {
  assert.match(cicKeyProblem({ ...key, expires_at: "2026-11-28T03:59:59Z" }, NOW) ?? "", /expired/);
  assert.equal(cicKeyProblem({ ...key, expires_at: null }, NOW), null);
});
