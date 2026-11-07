import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_ANNOUNCEMENT,
  announcementBody,
  announcementProblem,
  canReplyToTicket,
  creditCategoryTone,
  creditScoreView,
  filterFaqs,
  groupActivityByDay,
  parseMemberNumbers,
  preferenceLocked,
  safePortalLink,
  searchHref,
  setPreference,
  sortDividends,
  ticketProblem,
  toDateTimeInput,
} from "./engagement";
import { DEFAULT_PORTAL_CONFIG } from "./default-config";
import { requestDetails, requestTypesFor } from "./requests";
import type { PortalCreditScore, PortalDividend, PortalNotificationPreference } from "@/types/portal";

const SCORE: PortalCreditScore = {
  category: "Low risk",
  score: 82,
  max_score: 100,
  as_of: "2026-10-31",
  factors: [{ label: "Pays on time", impact: "positive", description: null }],
};

test("creditScoreView shows only what the portal setting allows", () => {
  assert.equal(creditScoreView(SCORE, "hidden"), null);
  const category = creditScoreView(SCORE, "category");
  assert.equal(category?.category, "Low risk");
  assert.equal(category?.score, null);
  assert.deepEqual(category?.factors, []);
  const score = creditScoreView(SCORE, "score");
  assert.equal(score?.score, 82);
  assert.deepEqual(score?.factors, []);
  assert.equal(creditScoreView(SCORE, "score_factors")?.factors.length, 1);
});

test("creditScoreView drops anything beyond label, impact and description", () => {
  const leaky = {
    ...SCORE,
    factors: [{ label: "Pays on time", impact: "positive", weight: 0.4, points: 30 }],
  } as unknown as PortalCreditScore;
  assert.deepEqual(creditScoreView(leaky, "score_factors")?.factors, [
    { label: "Pays on time", impact: "positive", description: null },
  ]);
});

test("creditScoreView shows nothing when there is nothing to show", () => {
  assert.equal(creditScoreView({ ...SCORE, category: null }, "category"), null);
  assert.equal(creditScoreView({ ...SCORE, max_score: 0 }, "score")?.maxScore, 100);
});

test("creditCategoryTone reads the server's category words", () => {
  assert.equal(creditCategoryTone("Low risk"), "success");
  assert.equal(creditCategoryTone("Moderate risk"), "warning");
  assert.equal(creditCategoryTone("High risk"), "danger");
  assert.equal(creditCategoryTone(null), "muted");
});

test("safePortalLink keeps links inside the member portal", () => {
  assert.equal(safePortalLink("/member/loans/12"), "/member/loans/12");
  assert.equal(safePortalLink("/member"), "/member");
  assert.equal(safePortalLink("https://evil.example/member"), null);
  assert.equal(safePortalLink("//evil.example"), null);
  assert.equal(safePortalLink("/memberish"), null);
  assert.equal(safePortalLink("/member\\..\\x"), null);
  assert.equal(safePortalLink("/dashboard"), null);
  assert.equal(safePortalLink(null), null);
});

const PREFS: PortalNotificationPreference[] = [
  { category: "security", mandatory: true, in_app: true, email: true, sms: true, push: false },
  { category: "loans", mandatory: false, in_app: true, email: false, sms: true, push: false },
];

test("setPreference changes one switch and never a mandatory or future one", () => {
  const next = setPreference(PREFS, "loans", "email", true);
  assert.equal(next[1].email, true);
  assert.equal(PREFS[1].email, false, "does not mutate");
  assert.equal(setPreference(PREFS, "security", "sms", false)[0].sms, true);
  assert.equal(setPreference(PREFS, "loans", "push", true)[1].push, false);
  assert.equal(preferenceLocked(PREFS[0], "email"), true);
  assert.equal(preferenceLocked(PREFS[1], "push"), true);
  assert.equal(preferenceLocked(PREFS[1], "sms"), false);
});

test("parseMemberNumbers splits on commas, spaces and lines and de-duplicates", () => {
  assert.deepEqual(parseMemberNumbers(" M-001, M-002\nM-001 ;M-003 "), ["M-001", "M-002", "M-003"]);
  assert.deepEqual(parseMemberNumbers("  "), []);
});

test("announcementProblem checks the audience it targets", () => {
  const base = { ...EMPTY_ANNOUNCEMENT, title: "AGM", body: "Join us." };
  assert.equal(announcementProblem(base), null);
  assert.equal(announcementProblem({ ...base, title: " " }), "Enter a title.");
  assert.match(announcementProblem({ ...base, audience: "branch" }) ?? "", /branch/);
  assert.match(announcementProblem({ ...base, audience: "member_type" }) ?? "", /member type/);
  assert.match(announcementProblem({ ...base, audience: "members" }) ?? "", /member number/);
  assert.match(
    announcementProblem({ ...base, publish_at: "2026-12-01T09:00", expires_at: "2026-11-30T09:00" }) ?? "",
    /after/,
  );
});

test("announcementBody sends only the chosen audience's targets", () => {
  const body = announcementBody({
    ...EMPTY_ANNOUNCEMENT,
    title: " AGM ",
    body: "x",
    audience: "branch",
    branch_ids: [2],
    member_numbers: ["M-1"],
    publish_at: "",
  });
  assert.equal(body.title, "AGM");
  assert.deepEqual(body.branch_ids, [2]);
  assert.deepEqual(body.member_numbers, []);
  assert.equal(body.publish_at, null);
});

test("sortDividends puts the newest year first", () => {
  const rows = [{ year: 2024 }, { year: 2026 }, { year: 2025 }] as PortalDividend[];
  assert.deepEqual(sortDividends(rows).map((r) => r.year), [2026, 2025, 2024]);
});

test("tickets: replies stop at closed and the form needs a subject and message", () => {
  assert.equal(canReplyToTicket("resolved"), true);
  assert.equal(canReplyToTicket("closed"), false);
  assert.equal(ticketProblem({ subject: "", message: "x" }), "Enter a subject.");
  assert.equal(ticketProblem({ subject: "Help", message: " " }), "Describe what you need help with.");
  assert.equal(ticketProblem({ subject: "Help", message: "x" }), null);
});

test("filterFaqs matches every word in the question or answer", () => {
  const faqs = [
    { question: "How do I pay my loan?", answer: "Use GCash or visit the branch." },
    { question: "How do I open savings?", answer: "Send a request." },
  ];
  assert.equal(filterFaqs(faqs, "").length, 2);
  assert.equal(filterFaqs(faqs, "gcash loan").length, 1);
  assert.equal(filterFaqs(faqs, "GCASH savings").length, 0);
});

test("groupActivityByDay groups by date in the order received", () => {
  const groups = groupActivityByDay([
    { id: "1", date: "2026-11-02T03:00:00Z", kind: "savings", description: "a", amount: 1 },
    { id: "2", date: "2026-11-02", kind: "loan", description: "b", amount: null },
    { id: "3", date: "2026-11-01", kind: "other", description: "c", amount: null },
  ]);
  assert.deepEqual(groups.map((g) => [g.key, g.rows.length]), [["2026-11-02", 2], ["2026-11-01", 1]]);
});

test("searchHref opens each kind on its own portal page", () => {
  const r = { id: 7, title: "x", subtitle: null, date: null };
  assert.equal(searchHref({ ...r, kind: "loan" }), "/member/loans/7");
  assert.equal(searchHref({ ...r, kind: "receipt" }), "/member/payments");
  assert.equal(searchHref({ ...r, kind: "transaction" }), "/member/activity");
});

test("auto-pay requests need loans, savings and auto-pay switched on", () => {
  const on = DEFAULT_PORTAL_CONFIG.features;
  assert.ok(requestTypesFor(on).includes("auto_pay"));
  assert.ok(!requestTypesFor({ ...on, auto_pay: false }).includes("auto_pay"));
  assert.deepEqual(
    requestDetails("auto_pay", { action: "disable", loan_id: "4", savings_account_id: "9", reason: "Closed account" }),
    { action: "disable", loan_id: "4", reason: "Closed account" },
  );
});

test("toDateTimeInput renders an API timestamp in local time for a datetime-local input", () => {
  const iso = "2026-11-07T16:30:00Z";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  assert.equal(toDateTimeInput(iso), expected);
  assert.equal(toDateTimeInput(null), null);
  assert.equal(toDateTimeInput("not a date"), null);
});
