import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POLL_FAILURES_BEFORE_REPORTING,
  pollIntervalFor,
  STATUS_POLL_HIDDEN_MS,
  STATUS_POLL_VISIBLE_MS,
} from "./use-import-status";

test("a tab in front is polled every ten seconds, one behind every sixty", () => {
  assert.equal(pollIntervalFor("visible"), STATUS_POLL_VISIBLE_MS);
  assert.equal(pollIntervalFor("hidden"), STATUS_POLL_HIDDEN_MS);
});

test("anything that is not the string 'hidden' gets the foreground rate", () => {
  // `document.visibilityState` also reports "prerender", and older engines may
  // report nothing at all. Only a tab that says it is hidden is treated as one.
  assert.equal(pollIntervalFor("prerender"), STATUS_POLL_VISIBLE_MS);
  assert.equal(pollIntervalFor(undefined), STATUS_POLL_VISIBLE_MS);
  assert.equal(pollIntervalFor(""), STATUS_POLL_VISIBLE_MS);
});

test("the cadences are overridable, and the hidden one is always the slower", () => {
  assert.equal(pollIntervalFor("hidden", 1_000, 5_000), 5_000);
  assert.equal(pollIntervalFor("visible", 1_000, 5_000), 1_000);
  assert.ok(STATUS_POLL_HIDDEN_MS > STATUS_POLL_VISIBLE_MS);
});

test("the foreground rate is faster than the server advances, but not by much", () => {
  // The processor moves its cursor roughly once a minute. Polling much faster
  // than 10 s buys nothing; polling slower than that makes a finished import
  // sit unreported.
  assert.ok(STATUS_POLL_VISIBLE_MS >= 5_000);
  assert.ok(STATUS_POLL_VISIBLE_MS <= 15_000);
});

test("one dropped poll is not reported as a failure", () => {
  // On a link that stalls for tens of seconds, replacing a live screen with an
  // error after a single missed request is how a working import gets abandoned.
  assert.ok(POLL_FAILURES_BEFORE_REPORTING >= 2);
});
