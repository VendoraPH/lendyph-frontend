import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LINDA_MESSAGES,
  buildLindaHistory,
  formatLindaValue,
  isImeComposing,
  lindaErrorMessage,
  normalizeLindaReply,
  safeLindaPath,
  type LindaMessage,
} from "./linda";

const reply = (intent: string) => ({ intent, answer: "x", blocks: [], links: [] });

test("history keeps answered turns with their intent, for follow-up questions", () => {
  const messages: LindaMessage[] = [
    { id: 1, role: "user", content: "How much did we collect this month?" },
    { id: 2, role: "assistant", content: "₱245,600.", reply: reply("collection_summary") },
  ];
  assert.deepEqual(buildLindaHistory(messages), [
    { role: "user", content: "How much did we collect this month?" },
    { role: "assistant", content: "₱245,600.", intent: "collection_summary" },
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
    ["b", "ok"],
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
    ["b", "ok"],
  );
});

test("trimmed history still starts with a question", () => {
  const messages: LindaMessage[] = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    role: i % 2 ? "assistant" : "user",
    content: String(i),
    reply: i % 2 ? reply("x") : undefined,
  }));
  assert.deepEqual(buildLindaHistory(messages, 3).map((t) => t.content), ["6", "7"]);
});

test("history sends only the most recent turns", () => {
  const messages: LindaMessage[] = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    role: i % 2 ? "assistant" : "user",
    content: String(i),
    reply: i % 2 ? reply("x") : undefined,
  }));
  const h = buildLindaHistory(messages, 4);
  assert.deepEqual(h.map((t) => t.content), ["26", "27", "28", "29"]);
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
  assert.equal(formatLindaValue({ label: "a", value: 245600, format: "currency" }), "₱245,600");
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

test("Escape and Enter are left to an IME that is composing", () => {
  assert.equal(isImeComposing({ isComposing: true, keyCode: 27 }), true);
  // Safari ends composition before the keydown; 229 still marks it.
  assert.equal(isImeComposing({ isComposing: false, keyCode: 229 }), true);
  assert.equal(isImeComposing({ isComposing: false, keyCode: 27 }), false);
});
