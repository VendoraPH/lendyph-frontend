import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../../../../next.config";
import { memberSources } from "./sources";

// With NEXT_PUBLIC_ENABLE_MEMBER_PORTAL off, every /member route is a plain
// 404 and nothing calls the API: the /member layout is a server component
// that answers not found before it renders the portal (whose config read is
// the first API call).
test("the /member layout answers not found while the switch is off, before any portal code", () => {
  const layout = memberSources(["app/member/layout.tsx"])[0].text;
  assert.doesNotMatch(layout, /^["']use client["']/m, "a server component");
  const guard = layout.indexOf("if (!env.features.memberPortal) notFound();");
  assert.ok(guard > 0, "the switch check");
  assert.ok(guard < layout.indexOf("<PortalConfigProvider>"), "checked before the portal renders");
});

test("every /member page sits under that layout", () => {
  const pages = memberSources(["app/member"]).filter((s) => s.file.endsWith("page.tsx"));
  assert.ok(pages.length >= 18, `${pages.length} pages`);
  for (const page of pages) assert.ok(page.file.startsWith("app/member/"), page.file);
});

test("/member pages can't be framed and send no full referrer", async () => {
  const rules = (await nextConfig.headers?.()) ?? [];
  for (const source of ["/member", "/member/:path*"]) {
    const rule = rules.find((r) => r.source === source);
    assert.ok(rule, source);
    const headers = Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.equal(headers["Content-Security-Policy"], "frame-ancestors 'none'");
    assert.equal(headers["Referrer-Policy"], "same-origin");
  }
});

test("notification links outside /member are dropped before they are followed", () => {
  const page = memberSources(["app/member/(signed-in)/(shell)/notifications/page.tsx"])[0].text;
  assert.match(page, /const link = safeMemberLink\(notice\.link\);/);
  assert.doesNotMatch(page, /router\.push\(notice\.link\)|href=\{notice\.link\}/);
});

test("the parts left for v2 have no member page (design §3, Not built in v1)", () => {
  const pages = memberSources(["app/member"]).map((s) => s.file);
  for (const dropped of ["/apply", "/applications", "/help", "/activity", "/search", "/credit-score", "/auto-pay", "/dividends", "/preferences", "/statements", "/activate", "/forgot-password"]) {
    assert.ok(!pages.some((file) => file.includes(`${dropped}/`)), dropped);
  }
  assert.ok(!pages.some((file) => /gcash/i.test(file)), "no GCash payment");
});
