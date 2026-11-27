import { test } from "node:test";
import assert from "node:assert/strict";
import { NOT_IN_YOUR_BRANCHES, portalErrorText } from "./errors";

const http = (status: number, message?: string) => ({ isAxiosError: true, response: { status, data: message ? { message } : {} } });

test("a 404 says the record may be in another branch, never 'not connected'", () => {
  assert.equal(portalErrorText(http(404), "x"), NOT_IN_YOUR_BRANCHES);
  assert.equal(portalErrorText(http(404, "No query results for model [App\\\\Models\\\\PortalRequest] 9"), "x"), NOT_IN_YOUR_BRANCHES);
});

test("a 403 shows the server's words, else a plain refusal", () => {
  const words = "Member Portal settings apply to every branch, so changing them needs the portal settings permission and access to all branches.";
  assert.equal(portalErrorText(http(403, words), "x"), words);
  assert.equal(portalErrorText(http(403), "x"), "You don't have permission to do that.");
});

test("a 409 shows the server's words", () => {
  const words = "Request REQ-20261111-000001 is waiting for its second approval in the savings approvals queue; decide it there.";
  assert.equal(portalErrorText(http(409, words), "x"), words);
});
