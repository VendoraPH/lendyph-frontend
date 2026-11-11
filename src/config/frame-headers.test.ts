import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildCustomRoute } from "next/dist/lib/build-custom-route";
import nextConfig from "../../next.config";

/**
 * The anti-framing page headers in next.config.ts, read through Next's own
 * route compiler (the regex the routes manifest matches with), so a path is
 * tested exactly as `next start` decides which headers it gets.
 */
type HeaderRoute = { source: string; headers: { key: string; value: string }[] };

async function headersFor(path: string): Promise<Record<string, string>> {
  const routes = ((await nextConfig.headers?.()) ?? []) as HeaderRoute[];
  const found: Record<string, string> = {};
  for (const route of routes) {
    const { regex } = buildCustomRoute("header", route) as { regex: string };
    if (new RegExp(regex, "i").test(path)) {
      for (const { key, value } of route.headers) {
        // Two rules may repeat a header; they must never disagree on it.
        assert.ok(found[key] === undefined || found[key] === value, `${path} gets two values for ${key}`);
        found[key] = value;
      }
    }
  }
  return found;
}

const STAFF_PATHS = [
  "/",
  "/login",
  "/dashboard",
  "/loans/12",
  "/accounting/reconciliation/3",
  "/member-portal",
  "/member-portal/codes",
  "/members",
  "/register",
];

const PORTAL_PATHS = ["/member", "/member/", "/member/loans", "/member/loans/4"];

describe("the staff app can be framed only by itself", () => {
  test("every non-/member page sends SAMEORIGIN and frame-ancestors 'self'", async () => {
    for (const path of STAFF_PATHS) {
      const headers = await headersFor(path);
      assert.equal(headers["X-Frame-Options"], "SAMEORIGIN", path);
      assert.equal(headers["Content-Security-Policy"], "frame-ancestors 'self'", path);
    }
  });

  test("the staff rule leaves the portal's referrer policy alone", async () => {
    const headers = await headersFor("/dashboard");
    assert.equal(headers["Referrer-Policy"], undefined);
  });
});

describe("the Member Portal is never framed", () => {
  test("/member keeps DENY and frame-ancestors 'none', with its referrer policy", async () => {
    for (const path of PORTAL_PATHS) {
      const headers = await headersFor(path);
      assert.equal(headers["X-Frame-Options"], "DENY", path);
      assert.equal(headers["Content-Security-Policy"], "frame-ancestors 'none'", path);
      assert.equal(headers["Referrer-Policy"], "same-origin", path);
    }
  });
});
