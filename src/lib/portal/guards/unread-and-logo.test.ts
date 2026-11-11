import { test } from "node:test";
import assert from "node:assert/strict";
import { memberSources } from "./sources";

const read = (file: string) => {
  const found = memberSources([file])[0];
  assert.ok(found, file);
  return found.text;
};

// The bell and the "N not yet read" line follow the server's count after a
// read, without waiting for the next page.
test("the bell listens for a new count", () => {
  assert.match(read("components/portal/notification-bell.tsx"), /onUnreadChanged\(\(count\) => setTotal\(count\.total\)\)/);
});

test("reading an announcement refreshes the count, and the page's line comes from it", () => {
  const page = read("app/member/(signed-in)/(shell)/announcements/page.tsx");
  assert.match(page, /readAnnouncement\(item\.id\)[\s\S]{0,200}refreshUnread\(\)/);
  assert.match(page, /onUnreadChanged\(\(count\) => setUnread\(count\.announcements\)\)/);
});

test("reading a notice, or all of them, refreshes the count", () => {
  const page = read("app/member/(signed-in)/(shell)/notifications/page.tsx");
  assert.match(page, /readNotification\(notice\.id\)[\s\S]{0,300}refreshUnread\(\)/);
  assert.match(page, /readAllNotifications\(\)[\s\S]{0,300}refreshUnread\(\)/);
});

// The logo is asked for only when the config names one, at most once a tab
// when it is missing, and is laid out without stretching it.
test("the logo reads logoToShow and remembers a 404", () => {
  const logo = read("components/portal/portal-logo.tsx");
  assert.match(logo, /logoToShow\(config\?\.logo_url\)/);
  assert.match(logo, /onError=\{[^}]*rememberLogoMissing/);
  assert.match(logo, /\bfill\b/, "fill in a sized box, so no width or height is overridden by CSS");
  assert.doesNotMatch(logo, /width=\{|height=\{/);
});
