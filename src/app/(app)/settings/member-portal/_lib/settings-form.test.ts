import { test } from "node:test";
import assert from "node:assert/strict";
import type { PortalSettings } from "@/types/portal-admin";
import { formOf, otpSwitchDisabled, settingsBody, settingsProblems, termsBody, termsProblems, EMPTY_TERMS } from "./settings-form";

const SAVED: PortalSettings = {
  enabled: false,
  portal_name: "Member Portal",
  welcome_message: null,
  support_contact: null,
  payment_instructions: null,
  session_minutes: 60,
  idle_minutes: 15,
  max_login_attempts: 5,
  lockout_minutes: 15,
  hard_lock_after: 3,
  password_min_length: 10,
  activation_code_hours: 72,
  reset_code_hours: 24,
  otp_required: false,
  otp_blocked_reason: "One-time passwords can't be turned on while text messages are only logged or reach nobody. Members would be unable to finish signing in.",
  features: { loans: true, savings: true, withdrawal_requests: true },
  dashboard_cards: ["loans", "savings"],
  withdrawal_methods: ["cash_pickup", "bank_transfer", "gcash"],
  withdrawal_hold_days: 7,
  request_expiry_days: 30,
  terms: null,
  updated_by: null,
  updated_at: null,
};

test("an untouched form sends nothing", () => {
  assert.deepEqual(settingsBody(formOf(SAVED), SAVED), {});
  assert.deepEqual(settingsProblems(formOf(SAVED)), {});
});

test("only what changed is sent, numbers as numbers", () => {
  const form = formOf(SAVED);
  form.numbers.session_minutes = "90";
  form.features = { ...form.features, savings: false };
  form.withdrawal_methods = ["cash_pickup"];
  form.support_contact = "  0917 000 0000 ";
  assert.deepEqual(settingsBody(form, SAVED), {
    support_contact: "0917 000 0000",
    session_minutes: 90,
    features: { savings: false },
    withdrawal_methods: ["cash_pickup"],
  });
});

test("the same lists in another order are not a change", () => {
  const form = formOf(SAVED);
  form.withdrawal_methods = ["gcash", "cash_pickup", "bank_transfer"];
  assert.deepEqual(settingsBody(form, SAVED), {});
});

test("the server's ranges are checked, and the idle timeout can't outlast the session", () => {
  const form = formOf(SAVED);
  form.numbers.session_minutes = "10";
  form.numbers.reset_code_hours = "1.5";
  form.numbers.withdrawal_hold_days = "31";
  const problems = settingsProblems(form);
  assert.equal(problems.session_minutes, "Enter a whole number from 15 to 240.");
  assert.equal(problems.reset_code_hours, "Enter a whole number from 1 to 72.");
  assert.equal(problems.withdrawal_hold_days, "Enter a whole number from 1 to 30.");
  const idle = formOf(SAVED);
  idle.numbers.session_minutes = "20";
  idle.numbers.idle_minutes = "30";
  assert.equal(settingsProblems(idle).idle_minutes, "The idle timeout can't be longer than the session (20 minutes).");
  const none = formOf(SAVED);
  none.withdrawal_methods = [];
  assert.equal(settingsProblems(none).withdrawal_methods, "Keep at least one payout method.");
});

test("OTP can't be switched on while the server gives a reason; once on, it can always be switched off", () => {
  assert.equal(otpSwitchDisabled(SAVED), true);
  assert.equal(otpSwitchDisabled({ ...SAVED, otp_blocked_reason: null }), false);
  assert.equal(otpSwitchDisabled({ ...SAVED, otp_required: true }), false);
});

test("the form has no self-registration, sign-in identifier or OTP method", () => {
  const keys = Object.keys(formOf(SAVED));
  for (const gone of ["self_registration", "login_identifiers", "otp_method"]) assert.equal(keys.includes(gone), false, gone);
});

test("terms need a version name the server accepts, a title and both texts", () => {
  assert.equal(termsProblems(EMPTY_TERMS).length, 4);
  const t = { ...EMPTY_TERMS, version: "2026-11", title: "Terms", terms_body: "T", privacy_body: "P" };
  assert.deepEqual(termsProblems(t), []);
  assert.equal(termsProblems({ ...t, version: "-bad" }).length, 1);
  assert.deepEqual(termsBody({ ...t, requires_reacceptance: true }), {
    version: "2026-11",
    title: "Terms",
    terms_body: "T",
    privacy_body: "P",
    requires_reacceptance: true,
  });
});
