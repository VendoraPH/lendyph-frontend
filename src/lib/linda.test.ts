import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LINDA_MESSAGES,
  LINDA_MAX_LINK_LENGTH,
  buildLindaHistory,
  formatLindaDateTime,
  formatLindaValue,
  isImeComposing,
  lindaErrorMessage,
  lindaLinkAriaLabel,
  lindaLinkLabel,
  normalizeLindaReply,
  safeLindaPath,
  type LindaMessage,
} from "./linda";

/**
 * Dates must read in Philippine time on any computer. This file runs in its own
 * process (each test file does), so it runs on a computer set to US Pacific
 * time, where a date read in the computer's zone lands a day early.
 */
process.env.TZ = "America/Los_Angeles";

const reply = (intent: string) => ({ intent, answer: "x", blocks: [], links: [] });

test("history keeps answered turns by their intent only, for follow-up questions", () => {
  const messages: LindaMessage[] = [
    { id: 1, role: "user", content: "How much did we collect this month?" },
    { id: 2, role: "assistant", content: "₱245,600.", reply: reply("collection_summary") },
  ];
  assert.deepEqual(buildLindaHistory(messages), [
    { role: "user", content: "How much did we collect this month?" },
    { role: "assistant", content: "", intent: "collection_summary" },
  ]);
});

test("history drops a failed answer and the question it failed on", () => {
  const messages: LindaMessage[] = [
    { id: 1, role: "user", content: "a" },
    { id: 2, role: "assistant", content: "error", failed: true },
    { id: 3, role: "user", content: "b" },
    { id: 4, role: "assistant", content: "ok", reply: reply("loan_summary") },
  ];
  assert.deepEqual(
    buildLindaHistory(messages).map((t) => t.content),
    ["b", ""],
  );
});

test("history drops a question whose request failed silently", () => {
  // A cancelled request, a 401 or a 423 leaves the question with no answer.
  const messages: LindaMessage[] = [
    { id: 1, role: "user", content: "a" },
    { id: 2, role: "user", content: "b" },
    { id: 3, role: "assistant", content: "ok", reply: reply("loan_summary") },
    { id: 4, role: "user", content: "c" },
  ];
  assert.deepEqual(
    buildLindaHistory(messages).map((t) => t.content),
    ["b", ""],
  );
});

test("trimmed history still starts with a question", () => {
  const messages: LindaMessage[] = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    role: i % 2 ? "assistant" : "user",
    content: String(i),
    reply: i % 2 ? reply("x") : undefined,
  }));
  assert.deepEqual(buildLindaHistory(messages, 3).map((t) => t.content), ["6", ""]);
});

test("an earlier answer's text never goes back to the server", () => {
  // Answers carry member names and figures; the model must never see them.
  const answers = [
    "Juan Dela Cruz owes ₱12,500.00, 32 days overdue.",
    `${"x".repeat(5000)}😀 tail`,
  ];
  const messages: LindaMessage[] = answers.flatMap((content, i) => [
    { id: i * 2, role: "user" as const, content: `q${i}` },
    { id: i * 2 + 1, role: "assistant" as const, content, reply: reply("overdue_accounts") },
  ]);
  const history = buildLindaHistory(messages);
  const sent = JSON.stringify(history);
  for (const answer of answers) assert.ok(!sent.includes(answer));
  assert.doesNotMatch(sent, /Juan|₱|x{10}|😀/u);
  assert.deepEqual(
    history.filter((t) => t.role === "assistant"),
    [
      { role: "assistant", content: "", intent: "overdue_accounts" },
      { role: "assistant", content: "", intent: "overdue_accounts" },
    ],
  );
});

test("history sends only the most recent turns", () => {
  const messages: LindaMessage[] = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    role: i % 2 ? "assistant" : "user",
    content: String(i),
    reply: i % 2 ? reply("x") : undefined,
  }));
  const h = buildLindaHistory(messages, 4);
  assert.deepEqual(h.map((t) => t.content), ["26", "", "28", ""]);
});

test("only in-app paths survive as links", () => {
  assert.equal(safeLindaPath("/borrowers/42"), "/borrowers/42");
  assert.equal(safeLindaPath("/loans/152?tab=x#y"), "/loans/152?tab=x#y");
  assert.equal(safeLindaPath("https://evil.example"), undefined);
  assert.equal(safeLindaPath("//evil.example/x"), undefined);
  assert.equal(safeLindaPath("javascript:alert(1)"), undefined);
  assert.equal(safeLindaPath("/\\evil.example"), undefined);
  assert.equal(safeLindaPath(42), undefined);
});

// Browsers drop tabs and newlines from a URL before following it, so each of
// these would otherwise open https://evil.example/ from a "View" link.
test("a link that a browser would send to another site is dropped", () => {
  assert.equal(safeLindaPath("/\t/evil.example"), undefined);
  assert.equal(safeLindaPath("/\n/evil.example"), undefined);
  assert.equal(safeLindaPath("/\r/evil.example"), undefined);
  assert.equal(safeLindaPath("/\u0000/evil.example"), undefined);
  assert.equal(safeLindaPath("\t//evil.example"), undefined);
});

test("encoded and dot-segment tricks cannot reach another site", () => {
  assert.equal(safeLindaPath("/%09/evil.example"), undefined);
  assert.equal(safeLindaPath("/%2F/evil.example"), undefined);
  assert.equal(safeLindaPath("/%5Cevil.example"), undefined);
  // The path resolves to "//evil.example", which is a link to that host.
  assert.equal(safeLindaPath("/.//evil.example"), undefined);
  assert.equal(safeLindaPath("/loans/..//evil.example"), undefined);
});

test("other ways to name another site or run script are dropped", () => {
  // "%2e%2e" is "..", so this resolves to the path "//evil.example".
  assert.equal(safeLindaPath("/%2e%2e//evil.example"), undefined);
  assert.equal(safeLindaPath("/%2E%2E//evil.example"), undefined);
  assert.equal(safeLindaPath("  //evil.example"), undefined);
  assert.equal(safeLindaPath("\\evil.example"), undefined);
  assert.equal(safeLindaPath("data:text/html,<script>alert(1)</script>"), undefined);
  assert.equal(safeLindaPath("vbscript:msgbox(1)"), undefined);
});

test("slash lookalikes and an @ stay paths on the app", () => {
  // U+2215 and U+FF0F are not "/" to a URL parser; they are encoded in place.
  assert.equal(safeLindaPath("/\u2215evil.example"), "/%E2%88%95evil.example");
  assert.equal(safeLindaPath("/\uFF0F\uFF0Fevil.example"), "/%EF%BC%8F%EF%BC%8Fevil.example");
  assert.equal(safeLindaPath("\u2215\u2215evil.example"), undefined);
  assert.equal(safeLindaPath("/@evil.example"), "/@evil.example");
});

test("API paths are not pages, so they are dropped", () => {
  assert.equal(safeLindaPath("/api/proxy/loans/152"), undefined);
  assert.equal(safeLindaPath("/api"), undefined);
  assert.equal(safeLindaPath("/API/proxy/x"), undefined);
  assert.equal(safeLindaPath("/./api/proxy/x"), undefined);
  assert.equal(safeLindaPath("/%61pi/proxy/x"), undefined);
  assert.equal(safeLindaPath("/apis"), "/apis");
});

test("an overlong link is dropped", () => {
  const long = `/loans/152?q=${"a".repeat(LINDA_MAX_LINK_LENGTH)}`;
  assert.equal(safeLindaPath(long), undefined);
  const fits = `/loans?q=${"a".repeat(LINDA_MAX_LINK_LENGTH - 9)}`;
  assert.equal(fits.length, LINDA_MAX_LINK_LENGTH);
  assert.equal(safeLindaPath(fits), fits);
});

test("a kept link is resolved against the app, not passed through raw", () => {
  assert.equal(safeLindaPath("/loans/../reports"), "/reports");
  assert.equal(safeLindaPath("/reports?q=a b"), "/reports?q=a%20b");
});

test("a reply keeps valid blocks and drops malformed ones one by one", () => {
  const r = normalizeLindaReply({
    intent: "overdue_accounts",
    answer: "There are 18 borrowers with overdue payments.",
    blocks: [
      { type: "stats", items: [{ label: "Total overdue", value: 126300, format: "currency" }, { value: 1 }] },
      {
        type: "list",
        ordered: true,
        items: [
          { title: "Juan Dela Cruz", fields: [{ label: "Days overdue", value: 32, format: "number" }], url: "/borrowers/7" },
          { title: "Maria Santos", url: "https://elsewhere.example" },
          { nope: true },
        ],
      },
      { type: "chart", items: [] },
      { type: "stats", items: [] },
    ],
    links: [
      { label: "View Overdue Accounts", url: "/reports/overdue" },
      { label: "Phish", url: "http://x.example" },
    ],
  });
  assert.ok(r);
  assert.equal(r.blocks.length, 2);
  assert.deepEqual(r.blocks[0], {
    type: "stats",
    title: undefined,
    items: [{ label: "Total overdue", value: 126300, format: "currency", currency: undefined }],
  });
  const list = r.blocks[1];
  assert.equal(list.type, "list");
  if (list.type === "list") {
    assert.equal(list.items.length, 2);
    assert.equal(list.items[0].url, "/borrowers/7");
    assert.equal(list.items[1].url, undefined);
  }
  assert.deepEqual(r.links, [{ label: "View Overdue Accounts", url: "/reports/overdue" }]);
});

test("a body with neither answer nor blocks is not a reply", () => {
  assert.equal(normalizeLindaReply(null), null);
  assert.equal(normalizeLindaReply({ intent: "x" }), null);
  assert.equal(normalizeLindaReply([1, 2]), null);
});

test("a reply with figures but no text does not say nothing was found", () => {
  const r = normalizeLindaReply({ blocks: [{ type: "stats", items: [{ label: "A", value: 1 }] }] });
  assert.equal(r?.answer, LINDA_MESSAGES.figuresOnly);
  assert.doesNotMatch(r?.answer ?? "", /couldn't find/);
  assert.equal(r?.intent, "unknown");
});

test("an as_of that is not a date is dropped", () => {
  const base = { answer: "x" };
  assert.equal(normalizeLindaReply({ ...base, as_of: "yesterday-ish" })?.as_of, undefined);
  assert.equal(normalizeLindaReply({ ...base, as_of: 12 })?.as_of, undefined);
  assert.equal(
    normalizeLindaReply({ ...base, as_of: "2026-10-02T02:30:00Z" })?.as_of,
    "2026-10-02T02:30:00Z",
  );
});

test("errors never surface the server's text", () => {
  assert.equal(lindaErrorMessage(500), LINDA_MESSAGES.aiUnavailable);
  assert.equal(lindaErrorMessage(503, "data_unavailable"), LINDA_MESSAGES.dataUnavailable);
  assert.equal(lindaErrorMessage(503, "ai_unavailable"), LINDA_MESSAGES.aiUnavailable);
  assert.equal(lindaErrorMessage(undefined), LINDA_MESSAGES.aiUnavailable);
  assert.equal(lindaErrorMessage(403), LINDA_MESSAGES.forbidden);
  assert.equal(lindaErrorMessage(404), LINDA_MESSAGES.notSetUp);
  assert.equal(lindaErrorMessage(501), LINDA_MESSAGES.notSetUp);
  assert.equal(lindaErrorMessage(429), LINDA_MESSAGES.rateLimited);
});

test("the cooperative's monthly limit and the user's daily limit say which one was hit", () => {
  assert.equal(
    lindaErrorMessage(429, "monthly_limit"),
    "Linda has reached this month's question limit for your cooperative. The suggested questions still work.",
  );
  assert.equal(
    lindaErrorMessage(429, "daily_limit"),
    "You've reached today's question limit. Please try again tomorrow.",
  );
  assert.equal(lindaErrorMessage(429), LINDA_MESSAGES.rateLimited);
  assert.equal(lindaErrorMessage(429, "too_many_requests"), LINDA_MESSAGES.rateLimited);
});

test("a question the server rejects is not met with 'try again'", () => {
  assert.equal(lindaErrorMessage(422), LINDA_MESSAGES.invalidQuestion);
  assert.equal(lindaErrorMessage(400), LINDA_MESSAGES.invalidQuestion);
  assert.doesNotMatch(LINDA_MESSAGES.invalidQuestion, /try again/i);
});

test("cancelled requests and session errors stay silent", () => {
  assert.equal(lindaErrorMessage(undefined, undefined, true), null);
  assert.equal(lindaErrorMessage(401), null);
  assert.equal(lindaErrorMessage(423), null);
});

test("values are formatted by Lendy's rules, not the model's", () => {
  assert.equal(formatLindaValue({ label: "a", value: 245600, format: "currency" }), "₱245,600.00");
  assert.equal(formatLindaValue({ label: "a", value: "125450.5", format: "currency" }), "₱125,450.50");
  assert.equal(formatLindaValue({ label: "a", value: 1340, format: "number" }), "1,340");
  assert.equal(formatLindaValue({ label: "a", value: 87.456, format: "percent" }), "87.456%");
  assert.equal(formatLindaValue({ label: "a", value: "2026-09-20", format: "date" }), "September 20, 2026");
  assert.equal(formatLindaValue({ label: "a", value: null, format: "currency" }), "—");
  assert.equal(formatLindaValue({ label: "a", value: "Active" }), "Active");
  assert.match(formatLindaValue({ label: "a", value: 10, format: "currency", currency: "USD" }), /10/);
});

test("rates and numbers are shown as sent, never rounded", () => {
  assert.equal(formatLindaValue({ label: "a", value: 2.375, format: "percent" }), "2.375%");
  assert.equal(formatLindaValue({ label: "a", value: "2.3750", format: "percent" }), "2.375%");
  assert.equal(formatLindaValue({ label: "a", value: 1.0625, format: "percent" }), "1.0625%");
  assert.equal(formatLindaValue({ label: "a", value: 1234.5678, format: "number" }), "1,234.5678");
});

test("a blank value shows a dash, not zero", () => {
  assert.equal(formatLindaValue({ label: "a", value: " ", format: "currency" }), "—");
  assert.equal(formatLindaValue({ label: "a", value: "", format: "number" }), "—");
  assert.equal(formatLindaValue({ label: "a", value: "  ", format: "percent" }), "—");
});

test("the fixture really runs on a computer west of Manila", () => {
  assert.equal(new Date("2026-12-05").getDate(), 4);
});

test("a date-only value reads its own day", () => {
  assert.equal(formatLindaValue({ label: "a", value: "2026-12-05", format: "date" }), "December 5, 2026");
  assert.equal(formatLindaValue({ label: "a", value: "2026-12-01", format: "date" }), "December 1, 2026");
});

test("a timestamp value reads its Philippine day", () => {
  assert.equal(
    formatLindaValue({ label: "a", value: "2026-12-04T16:30:00.000000Z", format: "date" }),
    "December 5, 2026",
  );
});

test("a server time with no zone is already Philippine time", () => {
  assert.equal(formatLindaValue({ label: "a", value: "2026-12-05 00:10:00", format: "date" }), "December 5, 2026");
  assert.match(formatLindaDateTime("2026-12-05 14:05:00"), /^Dec 5, 2026.* 02:05.PM$/i);
});

test("a value that is not a date is shown as sent", () => {
  assert.equal(formatLindaValue({ label: "a", value: "next week", format: "date" }), "next week");
});

test("the reply's as-of time reads in Philippine time", () => {
  assert.match(formatLindaDateTime("2026-12-04T16:30:00Z"), /^Dec 5, 2026.* 12:30.AM$/i);
});

test("a row's link says what it opens", () => {
  assert.equal(lindaLinkLabel("/borrowers/42"), "View member");
  assert.equal(lindaLinkLabel("/loans/152"), "View loan");
  assert.equal(lindaLinkLabel("/loans/152?tab=schedule#due"), "View loan");
  assert.equal(lindaLinkLabel("/payments/9"), "View payment");
  assert.equal(lindaLinkLabel("/payments/history"), "View");
  assert.equal(lindaLinkLabel("/loans/past-due"), "View");
  assert.equal(lindaLinkLabel("/borrowers/new"), "View");
  assert.equal(lindaLinkLabel("/reports"), "View");
});

test("a row's link names the row for screen readers", () => {
  assert.equal(lindaLinkAriaLabel("/borrowers/7", "Juan Dela Cruz"), "View member: Juan Dela Cruz");
  assert.equal(lindaLinkAriaLabel("/reports", "Collections"), "View: Collections");
});

test("the panel notice says what may leave Lendy and what never does", () => {
  assert.match(
    LINDA_MESSAGES.noHistory,
    /Questions Linda can't answer itself may be sent to an outside AI service; your Lendy records are never sent\.$/,
  );
  assert.match(LINDA_MESSAGES.noHistory, /^Linda does not save your chat history\./);
});

test("Escape and Enter are left to an IME that is composing", () => {
  assert.equal(isImeComposing({ isComposing: true, keyCode: 27 }), true);
  // Safari ends composition before the keydown; 229 still marks it.
  assert.equal(isImeComposing({ isComposing: false, keyCode: 229 }), true);
  assert.equal(isImeComposing({ isComposing: false, keyCode: 27 }), false);
});
