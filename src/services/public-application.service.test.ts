/**
 * `publicApplicationService` over REAL HTTP against a stub shaped like LO-B2's
 * `routes/api/public-apply/intake.php` and `PublicApplyController`.
 *
 * WHAT THIS PROVES: the applicant's screens call the merged routes
 * (`/api/public-apply/{token}`, not #615's `/public/apply/{token}`), send the
 * code step's fields, the privacy notice version on a new application, the
 * draft without the browser's own last step, document ids as strings, and
 * that signing out always ends in the browser, whatever the server answers.
 * WHAT IT DOES NOT PROVE: that the real controller behaves as written; that
 * is the backend's PublicIntake suite. The stub is only as honest as the
 * source it was read from.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import type { Consents } from "@/types/public-application";

const TOKEN = "Tq7m2Xc9Lp4Rz8Kd1Vb6Nw3Hy5Gf0Sa2";
const SESSION = "s".repeat(64);
const DOCUMENT_ID = "01jzq8r3m4n5p6q7r8s9t0v1w2";

interface Seen {
  method: string;
  path: string;
  session: string | undefined;
  body: Record<string, unknown> | null;
}

let server: Server;
let seen: Seen[] = [];
/** The status the logout route answers; RequireApplicationSession refuses an ended session with 401. */
let logoutStatus = 204;
let service: typeof import("./public-application.service").publicApplicationService;

const STATE = {
  reference_number: null,
  status: "draft",
  last_completed_step: "contact",
  completion_percent: 14,
  draft: {},
  documents: [],
  verified_contact: { mobile: "63917*****67", email: null },
  declared_totals: { monthly_income: null, monthly_expenses: "0.00", monthly_debt_payments: "0.00", monthly_remaining: null, income: [], expenses: [], debts: [] },
  missing_fields: {},
};

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      const header = req.headers["x-application-session"];
      seen.push({
        method: req.method ?? "",
        path,
        session: typeof header === "string" ? header : undefined,
        body: raw ? (JSON.parse(raw) as Record<string, unknown>) : null,
      });
      res.setHeader("Content-Type", "application/json");
      const route = path.startsWith(`/api/public-apply/${TOKEN}`) ? path.slice(`/api/public-apply/${TOKEN}`.length) : null;
      const send = (status: number, body?: unknown) => {
        res.statusCode = status;
        res.end(body === undefined ? "" : JSON.stringify(body));
      };

      if (route === null) return send(404, { message: "" });
      if (route === "" && req.method === "GET") return send(200, { data: { accepting: true, otp_channels: ["sms"] } });
      if (route === "/otp" && req.method === "POST") {
        return send(200, { data: { resend_after: 60, expires_in: 300, channel: "sms", destination: "63917*****67", delivered: true } });
      }
      if (route === "/otp/verify" && req.method === "POST") {
        return send(200, { data: { session_token: SESSION, expires_at: "2026-11-24T12:00:00Z", idle_minutes: 30, application: STATE } });
      }
      if (route === "/draft" && (req.method === "GET" || req.method === "PUT")) return send(200, { data: STATE });
      if (route === "/estimate" && req.method === "POST") return send(200, { data: { installment: "3,500.00" } });
      if (route === `/documents/${DOCUMENT_ID}` && req.method === "DELETE") return send(204);
      if (route === "/submit" && req.method === "POST") {
        return send(200, { data: { reference_number: "OA-2026-000001", submitted_at: "2026-11-24T04:00:00Z" } });
      }
      if (route === "/logout" && req.method === "POST") {
        return logoutStatus === 204
          ? send(204)
          : send(logoutStatus, { success: false, message: "Your session has ended. Ask for a new code to continue.", code: "session_expired" });
      }
      if (route === "/track" && req.method === "GET") return send(200, { data: { reference_number: "OA-2026-000001" } });
      return send(404, { message: "" });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  service = (await import("./public-application.service")).publicApplicationService;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  seen = [];
  logoutStatus = 204;
});

const last = () => seen[seen.length - 1];

test("the landing page is read from the merged route", async () => {
  const portal = await service.portal(TOKEN);
  assert.equal(portal.accepting, true);
  assert.deepEqual([last().method, last().path], ["GET", `/api/public-apply/${TOKEN}`]);
});

test("a code is asked for by text message, with the mobile and purpose only", async () => {
  await service.requestCode(TOKEN, { mobile: "0917 123 4567", purpose: "apply" });
  assert.equal(last().path, `/api/public-apply/${TOKEN}/otp`);
  assert.deepEqual(last().body, { channel: "sms", mobile: "0917 123 4567", purpose: "apply" });
});

test("verifying a new application sends the privacy notice version it was shown", async () => {
  const session = await service.verifyCode(TOKEN, { mobile: "09171234567", purpose: "apply" }, "042917", "2026.1");
  assert.equal(session.session_token, SESSION);
  assert.equal(last().path, `/api/public-apply/${TOKEN}/otp/verify`);
  assert.deepEqual(last().body, {
    channel: "sms",
    mobile: "09171234567",
    purpose: "apply",
    code: "042917",
    privacy_notice_version: "2026.1",
  });
});

test("resuming and tracking send no notice version; tracking names the reference", async () => {
  await service.verifyCode(TOKEN, { mobile: "09171234567", purpose: "resume" }, "042917");
  assert.deepEqual(last().body, { channel: "sms", mobile: "09171234567", purpose: "resume", code: "042917" });

  await service.verifyCode(TOKEN, { mobile: "09171234567", purpose: "track", reference_number: "OA-2026-000001" }, "042917");
  assert.deepEqual(last().body, {
    channel: "sms",
    mobile: "09171234567",
    purpose: "track",
    reference_number: "OA-2026-000001",
    code: "042917",
  });
});

test("the draft is saved with the session and without the browser's own last step", async () => {
  const state = await service.saveDraft(TOKEN, SESSION, { personal: {} } as never);
  assert.equal(state.last_completed_step, "contact");
  assert.deepEqual([last().method, last().path, last().session], ["PUT", `/api/public-apply/${TOKEN}/draft`, SESSION]);
  assert.deepEqual(Object.keys(last().body ?? {}), ["draft"]);
});

test("the draft is read back with the session", async () => {
  await service.getDraft(TOKEN, SESSION);
  assert.deepEqual([last().method, last().path, last().session], ["GET", `/api/public-apply/${TOKEN}/draft`, SESSION]);
});

test("the estimate sends the amount as typed, in pesos", async () => {
  await service.estimate(TOKEN, SESSION, { loan_product_id: 7, amount: "20000.50", term: 6, frequency: null });
  assert.equal(last().path, `/api/public-apply/${TOKEN}/estimate`);
  assert.deepEqual(last().body, { loan_product_id: 7, amount: "20000.50", term: 6, frequency: null });
  assert.equal(last().session, SESSION);
});

test("a document is removed by its string id", async () => {
  await service.removeDocument(TOKEN, SESSION, DOCUMENT_ID);
  assert.deepEqual([last().method, last().path, last().session], ["DELETE", `/api/public-apply/${TOKEN}/documents/${DOCUMENT_ID}`, SESSION]);
});

test("submit sends the accepted versions and answers the reference", async () => {
  const consents: Consents = {
    privacy_notice_version: "2026.1",
    terms_version: "2026.2",
    declaration_version: "2026.3",
    credit_authorization_version: null,
    marketing_opt_in: false,
  };
  const result = await service.submit(TOKEN, SESSION, consents);
  assert.equal(result.reference_number, "OA-2026-000001");
  assert.deepEqual([last().method, last().path, last().session], ["POST", `/api/public-apply/${TOKEN}/submit`, SESSION]);
  assert.deepEqual(last().body, consents);
});

test("tracking reads with its own session", async () => {
  await service.track(TOKEN, SESSION);
  assert.deepEqual([last().method, last().path, last().session], ["GET", `/api/public-apply/${TOKEN}/track`, SESSION]);
});

test("sign-out ends the session on the server", async () => {
  await service.logout(TOKEN, SESSION);
  assert.deepEqual([last().method, last().path, last().session], ["POST", `/api/public-apply/${TOKEN}/logout`, SESSION]);
});

test("sign-out always works: an ended session or a failed request still resolves", async () => {
  logoutStatus = 401;
  await assert.doesNotReject(service.logout(TOKEN, SESSION));
  await assert.doesNotReject(service.logout("unknown-link", SESSION));
});
