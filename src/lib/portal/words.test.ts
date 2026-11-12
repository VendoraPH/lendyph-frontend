import { test } from "node:test";
import assert from "node:assert/strict";
import { fileSize, penaltyMonthsText, plural, rateText, safeMemberLink } from "./words";

test("a rate reads as stored, trailing zeros dropped, never rounded", () => {
  assert.equal(rateText("3.0000"), "3%");
  assert.equal(rateText("2.7500"), "2.75%");
  assert.equal(rateText("1.23456"), "1.23456%");
  assert.equal(rateText("10"), "10%");
  assert.equal(rateText("3.0000", "monthly"), "3% per month");
  assert.equal(rateText("18.0000", "annual"), "18% per year");
  assert.equal(rateText(null), "—");
});

test("notification links stay inside the member portal", () => {
  for (const kept of ["/member", "/member/requests/12", "/member/savings/3", "/member/loans/9?tab=x", "/member/share-capital"]) {
    assert.equal(safeMemberLink(kept), kept, kept);
  }
  for (const dropped of [
    null,
    undefined,
    "",
    "/member-portal/requests/1",
    "/members",
    "/loans/1",
    "https://evil.example/member/x",
    "//evil.example/member",
    "/member//evil.example",
    "/member/../loans/1",
    "/member/./x/../../settings",
    "/member/\\evil",
    "javascript:alert(1)",
    " /member/x\n",
  ]) {
    assert.equal(safeMemberLink(dropped as string), dropped === " /member/x\n" ? "/member/x" : null, String(dropped));
  }
  assert.equal(safeMemberLink("/member/x\u0007"), null);
});

test("file sizes and counts read in words", () => {
  assert.equal(fileSize(512), "512 bytes");
  assert.equal(fileSize(2048), "2 KB");
  assert.equal(fileSize(1572864), "1.5 MB");
  assert.equal(fileSize(null), "—");
  assert.equal(plural(1, "loan"), "1 loan");
  assert.equal(plural(3, "loan"), "3 loans");
});

test("the monthly penalty note shows only for a charged month", () => {
  assert.equal(penaltyMonthsText(0), null);
  assert.equal(penaltyMonthsText(1), "Penalty: 1 month late");
  assert.equal(penaltyMonthsText(3), "Penalty: 3 months late");
  assert.equal(penaltyMonthsText(1.5), null);
});

test("percent-encoded dot segments can't step out of the member portal", () => {
  for (const dropped of [
    "/member/%2e%2e/loans/1",
    "/member/.%2e/loans/1",
    "/member/%2e./loans/1",
    "/member/%2E%2E/loans/1",
    "/member/%2e%2E/settings",
    "/member/x/%2E%2e/%2e%2e/users",
  ]) {
    assert.equal(safeMemberLink(dropped), null, dropped);
  }
});

test("a kept link is the resolved path, inside /member", () => {
  assert.equal(safeMemberLink("/member/requests/./12"), "/member/requests/12");
  assert.equal(safeMemberLink("/member/x/%2e%2e/requests/12"), "/member/requests/12");
  assert.equal(safeMemberLink("/member/loans/9?tab=x#top"), "/member/loans/9?tab=x#top");
});
