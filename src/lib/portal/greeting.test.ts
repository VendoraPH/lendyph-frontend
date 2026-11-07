import { test } from "node:test";
import assert from "node:assert/strict";
import { greeting, manilaHour } from "./greeting";

test("reads the hour in Manila, not UTC", () => {
  // 23:30 UTC is 07:30 the next day in Manila.
  assert.equal(manilaHour(new Date("2026-10-14T23:30:00Z")), 7);
});

test("greets by the time of day", () => {
  assert.equal(greeting("Juan", new Date("2026-10-14T23:30:00Z")), "Good morning, Juan");
  assert.equal(greeting("Juan", new Date("2026-10-15T06:00:00Z")), "Good afternoon, Juan");
  assert.equal(greeting("Juan", new Date("2026-10-15T12:00:00Z")), "Good evening, Juan");
  assert.equal(greeting("", new Date("2026-10-15T12:00:00Z")), "Good evening");
});
