import { test } from "node:test";
import assert from "node:assert/strict";
import type { CodeSent } from "@/types/public-application";
import { cleanCode, isOtpCode, otpNotice } from "./otp";

// The code step as LO-B2's ApplicantOtp answers it: 6 digits, 5 minutes, by
// text message only, and on a staging test link a staff number sees its code
// on screen ("Test mode: not sent").

const SENT: CodeSent = {
  resend_after: 60,
  expires_in: 300,
  channel: "sms",
  destination: "63917*****67",
  delivered: true,
};

test("a delivered code says where it went and how long it lasts", () => {
  assert.deepEqual(otpNotice(SENT), {
    text: "We sent a code to 63917*****67. It expires in 5 minutes.",
    testCode: null,
  });
});

test("test mode shows the code on screen with the server's notice, never as sent", () => {
  const shown = otpNotice({ ...SENT, delivered: false, test_mode: { code: "042917", notice: "Test mode: not sent" } });
  assert.equal(shown.testCode, "042917");
  assert.equal(shown.text, "Test mode: not sent. Use the code below; it expires in 5 minutes.");
  assert.doesNotMatch(shown.text, /We sent/);
});

test("a code that reached nobody says so, never that it was sent", () => {
  const nothing = otpNotice({ ...SENT, delivered: false });
  assert.equal(nothing.testCode, null);
  assert.equal(nothing.text, "No code was sent to 63917*****67. Check the number, or contact the office.");
});

test("a code is exactly six digits, as the server checks it", () => {
  assert.equal(isOtpCode("042917"), true);
  assert.equal(isOtpCode("04291"), false);
  assert.equal(isOtpCode("0429177"), false);
  assert.equal(isOtpCode("04291a"), false);
  assert.equal(isOtpCode(""), false);
});

test("spaces typed inside a code are dropped before it is checked and sent", () => {
  assert.equal(cleanCode(" 042 917 "), "042917");
  assert.equal(isOtpCode(cleanCode("042 917")), true);
});
