import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldErrors, NOT_AVAILABLE, publicErrorMessage, SESSION_ENDED, sessionProblem } from "./errors";

// How the public routes refuse (RequireApplicationSession, ApplicantIntake,
// ApplicantOtp and Laravel's own JSON errors), read as the applicant sees them.

const reply = (status: number, data: Record<string, unknown> = {}) => ({
  isAxiosError: true,
  request: {},
  response: { status, data },
});

test("a refusal shows the server's words", () => {
  const otherLink = "You already have an application in progress from another link. Open that link to continue it.";
  assert.equal(publicErrorMessage(reply(409, { message: otherLink }), "fallback"), otherLink);
  assert.equal(
    publicErrorMessage(reply(404, { message: "We couldn't find an application in progress for this number." }), "fallback"),
    "We couldn't find an application in progress for this number.",
  );
  assert.equal(
    publicErrorMessage(reply(429, { message: "This number has asked for too many codes today. Please try again tomorrow." }), "x"),
    "This number has asked for too many codes today. Please try again tomorrow.",
  );
});

test("a field refusal shows the field's words", () => {
  const err = reply(422, {
    message: "The code is wrong or has expired. Ask for a new code.",
    errors: { code: ["The code is wrong or has expired. Ask for a new code."] },
  });
  assert.equal(publicErrorMessage(err, "fallback"), "The code is wrong or has expired. Ask for a new code.");
});

test("an unknown link or a switched-off server reads as not available", () => {
  assert.equal(publicErrorMessage(reply(404, { message: "" }), "fallback"), NOT_AVAILABLE);
  assert.equal(publicErrorMessage(reply(404, { message: "Not Found" }), "fallback"), NOT_AVAILABLE);
  assert.equal(publicErrorMessage(reply(501), "fallback"), NOT_AVAILABLE);
});

test("an ended session reads the server's words, else asks for a new code", () => {
  const expired = "Your session has ended. Ask for a new code to continue.";
  assert.equal(publicErrorMessage(reply(401, { message: expired, code: "session_expired" }), "x"), expired);
  assert.equal(publicErrorMessage(reply(401), "x"), SESSION_ENDED);
  assert.equal(SESSION_ENDED, expired);
});

test("the virus check being down shows the server's words", () => {
  const down = "Files can't be checked for viruses right now. Try again in a few minutes.";
  assert.equal(publicErrorMessage(reply(503, { success: false, message: down }), "x"), down);
});

test("the framework's own throttle words are replaced", () => {
  assert.equal(
    publicErrorMessage(reply(429, { message: "Too Many Attempts." }), "x"),
    "Too many attempts. Please wait a moment and try again.",
  );
});

test("the session refusals the wizard acts on are told apart by their code", () => {
  assert.equal(sessionProblem(reply(401, { code: "session_expired" })), "ended");
  assert.equal(sessionProblem(reply(401, { code: "session_required" })), "ended");
  assert.equal(sessionProblem(reply(409, { code: "session_submitted" })), "submitted");
  assert.equal(sessionProblem(reply(409, { code: "link_closed" })), "closed");
  assert.equal(sessionProblem(reply(409, { message: "Something else." })), null);
  assert.equal(sessionProblem(reply(422)), null);
  assert.equal(sessionProblem(new Error("no reply")), null);
});

test("a 422's fields keep their first message each", () => {
  const err = reply(422, {
    errors: { "draft.personal.gender": ["Choose your gender."], documents: ["Upload your proof of income.", "x"] },
  });
  assert.deepEqual(fieldErrors(err), {
    "draft.personal.gender": "Choose your gender.",
    documents: "Upload your proof of income.",
  });
  assert.equal(fieldErrors(reply(409, { message: "x" })), null);
});
