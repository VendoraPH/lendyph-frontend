import assert from "node:assert/strict";
import { test } from "node:test";

import { CIC_RATE_LIMIT_WORDS, cicRateLimitMessage, cicRefusal, withCicRateLimitWords } from "./refusal";

test("a refusal's code and validation counts are read from the server's body", () => {
  const validation = { errors: 0, warnings: 2, top_issues: [] };
  const err = { response: { status: 422, data: { message: "Review the warnings.", code: "warnings_unconfirmed", data: { validation } } } };
  assert.deepEqual(cicRefusal(err), { code: "warnings_unconfirmed", validation });
});

test("anything else carries no code and no counts", () => {
  assert.deepEqual(cicRefusal(new Error("offline")), { code: null, validation: null });
  assert.deepEqual(cicRefusal({ response: { data: { code: "x", data: { validation: { errors: "1" } } } } }), {
    code: "x",
    validation: null,
  });
});

const tooMany = (data: unknown, headers: Record<string, unknown> = {}) => ({ response: { status: 429, data, headers } });

test("a 429 with Laravel's default text reads in words, with the wait the server gives", () => {
  assert.equal(cicRateLimitMessage(tooMany({ message: "Too Many Attempts." })), CIC_RATE_LIMIT_WORDS);
  assert.equal(
    cicRateLimitMessage(tooMany({ message: "Too Many Attempts.", retry_after: 42 })),
    "Too many CIC requests. Wait 42 seconds and try again.",
  );
  assert.equal(
    cicRateLimitMessage(tooMany({ message: "Too Many Attempts." }, { "retry-after": "1" })),
    "Too many CIC requests. Wait 1 second and try again.",
  );
  assert.equal(
    cicRateLimitMessage(tooMany({}, { "retry-after": "125" })),
    "Too many CIC requests. Wait 3 minutes and try again.",
  );
});

test("a 429 the server worded itself keeps its words; other answers are left alone", () => {
  assert.equal(cicRateLimitMessage(tooMany({ message: "You've exported 5 files this minute." })), "You've exported 5 files this minute.");
  assert.equal(cicRateLimitMessage({ response: { status: 422, data: { message: "Too Many Attempts." } } }), null);
  assert.equal(cicRateLimitMessage(new Error("offline")), null);
});

test("the words go into the body's message, where the error readers look", () => {
  const err = tooMany({ message: "Too Many Attempts.", retry_after: 30 });
  assert.equal(withCicRateLimitWords(err), err);
  assert.deepEqual(err.response.data, { message: "Too many CIC requests. Wait 30 seconds and try again.", retry_after: 30 });
  const other = { response: { status: 403, data: { message: "No." } } };
  withCicRateLimitWords(other);
  assert.deepEqual(other.response.data, { message: "No." });
});
