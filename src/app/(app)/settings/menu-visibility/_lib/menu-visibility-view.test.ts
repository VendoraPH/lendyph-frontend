/**
 * Settings → Menu Visibility: the switch list, the save summary, the
 * override's refusals and the password field (finish run round 6).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { MenuVisibilityModule } from "@/types/menu-visibility";
import {
  accessEndsText,
  draftFrom,
  hiddenPayload,
  isOverrideRequired,
  menuVisibilityRows,
  overrideRefusal,
  saveSummary,
  takePassword,
} from "./menu-visibility-view";

const mod = (key: string, label: string, parent: string | null = null, hidden = false): MenuVisibilityModule => ({
  key,
  label,
  parent,
  hidden,
});

const SERVER: MenuVisibilityModule[] = [
  mod("audit_trail", "Audit Trail"),
  mod("dashboard", "Dashboard"),
  mod("loans", "Loans"),
  mod("loans.reminders", "Reminders", "loans"),
  mod("loans.origination", "Loan Origination", "loans"),
  mod("linda", "Linda"),
  mod("savings", "Savings", null, true),
  mod("cda", "CDA Compliance"),
  mod("payments", "Payments"),
  mod("payments.auto_pay", "Auto-Pay", "payments"),
];

const allInBuild = () => true;
const err = (status: number, data: unknown) => ({ response: { status, data } });

test("rows follow the side menu's order, submenus indented under their parent", () => {
  const rows = menuVisibilityRows(SERVER, draftFrom(SERVER), allInBuild);
  assert.deepEqual(
    rows.map((r) => [r.key, r.depth]),
    [
      ["dashboard", 0],
      ["linda", 0],
      ["loans", 0],
      ["loans.reminders", 1],
      ["loans.origination", 1],
      ["payments", 0],
      ["payments.auto_pay", 1],
      ["savings", 0],
      ["cda", 0],
      ["audit_trail", 0],
    ],
  );
  assert.equal(rows.find((r) => r.key === "savings")?.shown, false);
  assert.equal(rows.find((r) => r.key === "cda")?.shown, true);
});

test("only the modules this build has are listed", () => {
  const rows = menuVisibilityRows(SERVER, draftFrom(SERVER), (key) => key !== "cda" && key !== "loans.origination");
  assert.equal(rows.some((r) => r.key === "cda"), false);
  assert.equal(rows.some((r) => r.key === "loans.origination"), false);
  assert.equal(rows.some((r) => r.key === "unknown"), false);
});

test("a submenu's switch is disabled, with its reason, while its parent is off", () => {
  const draft = new Set(["loans"]);
  const rows = menuVisibilityRows(SERVER, draft, allInBuild);
  const reminders = rows.find((r) => r.key === "loans.reminders");
  assert.equal(reminders?.disabled, true);
  assert.equal(reminders?.note, "Shown only when Loans is on");
  // Its own switch keeps its own state.
  assert.equal(reminders?.shown, true);
  const autoPay = rows.find((r) => r.key === "payments.auto_pay");
  assert.equal(autoPay?.disabled, false);
  assert.equal(autoPay?.note, null);
});

test("the save summary names what changes, in the menu's order", () => {
  const saved = new Set(["cda"]);
  const draft = new Set(["savings", "linda"]);
  assert.equal(saveSummary(saved, draft, SERVER), "Hide: Linda, Savings. Show: CDA Compliance.");
  assert.equal(saveSummary(new Set(), new Set(["savings"]), SERVER), "Hide: Savings.");
  assert.equal(saveSummary(new Set(["savings"]), new Set(), SERVER), "Show: Savings.");
  assert.equal(saveSummary(new Set(["savings"]), new Set(["savings"]), SERVER), null);
});

test("a save sends the switched-off keys, keeping ones this build doesn't list", () => {
  assert.deepEqual(hiddenPayload(new Set(["savings", "zzz_future", "dashboard"])), ["dashboard", "savings", "zzz_future"]);
});

test("the override's refusals read the server's words in the right place", () => {
  const wrong = err(422, { message: "The given data was invalid.", errors: { password: ["That password isn't right."] } });
  assert.deepEqual(overrideRefusal(wrong), { field: "That password isn't right." });
  const locked = err(429, { message: "Too many tries. Try again in 12 minutes." });
  assert.deepEqual(overrideRefusal(locked), { message: "Too many tries. Try again in 12 minutes." });
  const notSet = err(503, { message: "The administrator override isn't set up on this server yet." });
  assert.deepEqual(overrideRefusal(notSet), { message: "The administrator override isn't set up on this server yet." });
  assert.deepEqual(overrideRefusal(err(403, { message: "This action is unauthorized." })), { denied: true });
  assert.ok(overrideRefusal(new Error("Network Error")).message);
  assert.doesNotMatch(overrideRefusal(new Error("Network Error")).message ?? "", /network error/i);
});

test("a 403 override_required asks for the password again; any other 403 doesn't", () => {
  assert.equal(isOverrideRequired(err(403, { code: "override_required", message: "Enter the administrator password to open Menu Visibility." })), true);
  assert.equal(isOverrideRequired(err(403, { message: "Forbidden" })), false);
  assert.equal(isOverrideRequired(err(422, { code: "override_required" })), false);
});

test("the access line reads the time it ends", () => {
  assert.match(accessEndsText("2026-11-25T08:15:00Z") ?? "", /^Access ends at 4:15\sPM$/);
  assert.equal(accessEndsText(null), null);
});

test("the password is taken from the field once and the field is emptied", () => {
  const field = { value: "s3cret!" };
  assert.equal(takePassword(field), "s3cret!");
  assert.equal(field.value, "");
  assert.equal(takePassword(null), "");
});

// The password is never kept: no React state, storage or log holds it, and
// the field is never prefilled.
test("the password dialog keeps the password nowhere", () => {
  const dir = resolve(process.cwd(), "src/app/(app)/settings/menu-visibility");
  const files: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx")) files.push(full);
    }
  };
  walk(dir);
  const dialog = readFileSync(join(dir, "_components/override-password-dialog.tsx"), "utf8");
  assert.match(dialog, /type="password"/);
  assert.match(dialog, /autoComplete="off"/);
  assert.doesNotMatch(dialog, /defaultValue|value=\{/);
  assert.match(dialog, /takePassword\(/);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /useState[^\n]*[Pp]assword/, file);
    assert.doesNotMatch(text, /localStorage|sessionStorage|console\./, file);
  }
});

test("the page sits behind menu_visibility:manage", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/settings/menu-visibility/page.tsx"), "utf8");
  assert.match(page, /<RouteGuard permission="menu_visibility:manage" pageName="Menu Visibility">/);
});
