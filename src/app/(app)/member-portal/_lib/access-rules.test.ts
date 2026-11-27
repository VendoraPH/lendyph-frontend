import { test } from "node:test";
import assert from "node:assert/strict";
import type { PortalAccessCard, PortalCodeSlip } from "@/types/portal-admin";
import { accessOffer, inviteBlocked, issueCodeTitle, portalAddress, slipHtml } from "./access-rules";

const member = { id: 7, name: "Juan Dela Cruz", member_number: "BRW-000007", status: "active", has_birthdate: true };
const card = (over: Partial<PortalAccessCard>): PortalAccessCard => ({
  member,
  state: "not_invited",
  invited_at: null,
  activated_at: null,
  last_login_at: null,
  password_changed_at: null,
  locked_until: null,
  disabled_reason: null,
  terms_version: null,
  code: null,
  ...over,
});

test("a member never invited is offered Invite and nothing else", () => {
  const o = accessOffer(card({}));
  assert.equal(o.invite, "invite");
  assert.deepEqual([o.resetCode, o.unlock, o.signOut, o.disable, o.enable], [false, false, false, false, false]);
});

test("an invited member is offered a new code and turning access off", () => {
  const o = accessOffer(card({ state: "invited" }));
  assert.equal(o.invite, "reissue");
  assert.equal(o.disable, true);
  assert.equal(o.resetCode, false);
});

test("an active account offers a reset code, sign out everywhere and turning off; never an activation code", () => {
  const o = accessOffer(card({ state: "active" }));
  assert.equal(o.invite, null);
  assert.deepEqual([o.resetCode, o.signOut, o.disable, o.unlock], [true, true, true, false]);
});

test("a locked account also offers Unlock", () => {
  const o = accessOffer(card({ state: "locked" }));
  assert.deepEqual([o.unlock, o.resetCode, o.signOut], [true, true, true]);
});

test("a reset code needs an active member, as the server checks", () => {
  assert.equal(accessOffer(card({ state: "active", member: { ...member, status: "inactive" } })).resetCode, false);
});

test("access turned off by staff can be turned back on; a membership that ended can't", () => {
  assert.equal(accessOffer(card({ state: "disabled", disabled_reason: "security_concern" })).enable, true);
  for (const reason of ["membership_ended", "deceased"] as const) {
    const o = accessOffer(card({ state: "disabled", disabled_reason: reason }));
    assert.equal(o.enable, false);
    assert.equal(o.enableBlocked, "This membership has ended, so portal access stays off.");
  }
});

test("an invite needs an active member with a birthdate", () => {
  assert.equal(inviteBlocked(card({})), null);
  assert.match(inviteBlocked(card({ member: { ...member, has_birthdate: false } })) ?? "", /birthdate/);
  assert.match(inviteBlocked(card({ member: { ...member, status: "pending" } })) ?? "", /active member/);
});

test("the slip's address is built from this app's own origin and the server's path", () => {
  assert.equal(portalAddress("https://binhs-coop.example.ph", "/member"), "https://binhs-coop.example.ph/member");
  assert.equal(portalAddress("http://localhost:3000", "/member"), "http://localhost:3000/member");
});

test("a path that could point elsewhere gives no address", () => {
  for (const path of ["https://evil.example/member", "//evil.example/member", "/\\evil.example", "member", "javascript:alert(1)"]) {
    assert.equal(portalAddress("https://binhs-coop.example.ph", path), null, path);
  }
});

const slip: PortalCodeSlip = {
  title: "Member Portal activation code",
  member_name: "Juan <b>Dela</b> Cruz",
  member_number: "BRW-000007",
  code: "ABCD-EFGH-JKMN",
  expires_at: "2026-11-14T07:00:00Z",
  expires_at_text: "14 Nov 2026, 3:00 PM (Philippine time)",
  portal_path: "/member",
  instructions: ["Open the member portal.", "Enter your member number.", "Choose a password."],
};

test("the slip prints the member, the code, the expiry, the address and the steps, escaped, with no money", () => {
  const html = slipHtml(slip, "https://binhs-coop.example.ph/member", "BINHS Cooperative");
  for (const part of ["ABCD-EFGH-JKMN", "BRW-000007", "14 Nov 2026, 3:00 PM (Philippine time)", "https://binhs-coop.example.ph/member", "Choose a password.", "BINHS Cooperative"]) {
    assert.ok(html.includes(part), part);
  }
  assert.ok(html.includes("Juan &lt;b&gt;Dela&lt;/b&gt; Cruz"));
  assert.doesNotMatch(html, /₱|\$\d/);
});

test("with no address the slip shows the path the server sent", () => {
  assert.ok(slipHtml(slip, null, "").includes("<dd>/member</dd>"));
});

test("the code dialog asks with the right article for each code", () => {
  assert.equal(issueCodeTitle("activation"), "Issue an activation code?");
  assert.equal(issueCodeTitle("reset"), "Issue a password reset code?");
});
