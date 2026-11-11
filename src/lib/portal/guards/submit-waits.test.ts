import { test } from "node:test";
import assert from "node:assert/strict";
import { linesMatching, memberSources } from "./sources";

// "Never show success before the server confirms" (portal TASK 74). Every
// member write goes through `useConfirmedSubmit`, which says it worked only
// once the server answered 201, 202 or 200 as expected (`whenConfirmed`,
// tested in server-confirm.test.ts). So:
const FILES = memberSources();
const HOOK = "lib/portal/hooks/use-confirmed-submit.ts";
const SERVICE = "lib/portal/portal-api.ts";

test("only the confirmed-submit hook shows a success message", () => {
  for (const { file, text } of FILES) {
    if (file === HOOK) continue;
    assert.deepEqual(linesMatching(text, /\bnotifySuccess\s*\(|toast\.success\s*\(/), [], file);
  }
});

test("the hook shows success inside the server's confirmation, never before", () => {
  const hook = memberSources([HOOK])[0].text;
  assert.match(hook, /whenConfirmed\(\s*run\(write\),\s*options\.expect,\s*\(data, status\) => \{\s*notifySuccess\(/);
});

test("only the portal service calls the client", () => {
  for (const { file, text } of FILES) {
    if (file === SERVICE || file === "lib/portal/portal-client.ts") continue;
    assert.deepEqual(linesMatching(text, /\bportalApi\.|\bportalHttp\b/), [], file);
  }
});

test("every member write hands its caller the server's status", () => {
  const service = memberSources([SERVICE])[0].text;
  const unconfirmed = [...service.matchAll(/(\w+): \([^)]*\)[^=]*=>\s*portalApi\.(?:post|put|delete)</g)].map((m) => m[1]);
  // Plain posts: the code checks (their answer is the next step, not a
  // success message), signing out, and marking a notice or announcement read.
  assert.deepEqual(unconfirmed, ["verifyCode", "verifyOtp", "logout", "readNotification", "readAnnouncement"]);
  assert.ok(/postConfirmed/.test(service) && /deleteConfirmed/.test(service));
});

test("a new request is sent with its Idempotency-Key and waits for the 201", () => {
  const service = memberSources([SERVICE])[0].text;
  assert.match(service, /createRequest: \(body: NewRequestBody, key: string \| null\)[^\n]*\n\s*portalApi\.postConfirmed<RequestDetail>\(E\.REQUESTS, body, idempotencyHeaders\(key\)\)/);
  const dialog = FILES.find((s) => s.file.endsWith("requests/_components/new-request-dialog.tsx"));
  assert.ok(dialog);
  assert.match(dialog.text, /submit\(\(key\) => portalService\.createRequest\(body, key\), \{\s*expect: CONFIRMS\.created,/);
});

test("every submit button waits: it is disabled while its write is in flight", () => {
  const writers = FILES.filter((s) => s.file.endsWith(".tsx") && /useConfirmedSubmit|useSubmitGuard/.test(s.text));
  assert.ok(writers.length >= 10, `${writers.length} files write`);
  for (const { file, text } of writers) {
    const submits = text.match(/<Button[^>]*type="submit"[^>]*>/g) ?? [];
    for (const button of submits) assert.match(button, /disabled=\{[^}]*submitting/, `${file}: ${button}`);
  }
});
