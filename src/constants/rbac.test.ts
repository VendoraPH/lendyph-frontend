import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLES } from "./rbac";

const REMINDERS = ["reminders:view", "reminders:send", "reminders:pause", "reminders:settings"];

// Phase 2: the four reminders permissions are seeded for admin and
// super_admin only. super_admin has no entry in this map (see `Role`).
test("admin holds all four reminders permissions", () => {
  assert.deepEqual(
    ROLES.admin.permissions.filter((p) => p.startsWith("reminders:")),
    REMINDERS,
  );
});

test("no role but admin holds a reminders permission", () => {
  for (const [role, config] of Object.entries(ROLES)) {
    if (role === "admin") continue;
    assert.deepEqual(
      config.permissions.filter((p) => p.startsWith("reminders:")),
      [],
      role,
    );
  }
});
