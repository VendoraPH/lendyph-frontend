import { test } from "node:test";
import assert from "node:assert/strict";
import { canToggleActive, roleActivationError } from "./role-activation";

const FALLBACK = "We couldn't update the role status. Please try again.";

test("admin and super_admin have no activate/deactivate button", () => {
  assert.equal(canToggleActive("admin"), false);
  assert.equal(canToggleActive("super_admin"), false);
  assert.equal(canToggleActive("cashier"), true);
  assert.equal(canToggleActive("night_desk"), true);
});

test("a 409 shows the conflict message and reloads the list", () => {
  assert.deepEqual(
    roleActivationError(
      { response: { status: 409, data: { message: "This role was changed or deleted by another request. Reload and try again." } } },
      FALLBACK,
    ),
    { message: "This role was changed or deleted by another request. Reload and try again.", reload: true },
  );
});

test("a 422 shows the server's reason (self-lockout, grant refusal)", () => {
  const lockout = "You can't deactivate a role you hold. Another administrator has to do it for you.";
  assert.deepEqual(
    roleActivationError({ response: { status: 422, data: { message: lockout, errors: { role: [lockout] } } } }, FALLBACK),
    { message: lockout, reload: false },
  );

  const grant = "You can't grant permissions you do not hold yourself (loans:view).";
  assert.deepEqual(
    roleActivationError({ response: { status: 422, data: { message: grant, errors: { role: [grant] } } } }, FALLBACK),
    { message: grant, reload: false },
  );
});

test("anything else keeps the generic message", () => {
  assert.deepEqual(roleActivationError({ response: { status: 500, data: {} } }, FALLBACK), {
    message: FALLBACK,
    reload: false,
  });
  assert.deepEqual(roleActivationError(new Error("boom"), FALLBACK), { message: FALLBACK, reload: false });
});
