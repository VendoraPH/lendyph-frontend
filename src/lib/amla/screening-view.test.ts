import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AmlaOrderDetail, AmlaScreeningMatchDetail, AmlaWatchlist } from "@/types/amla-screening";
import {
  AMLA_MATCH_STATUS_OPTIONS,
  AMLA_MATCH_SUBJECT_OPTIONS,
  AMLA_ORDER_AUTHORITY_OPTIONS,
  AMLA_ORDER_STATUS_OPTIONS,
  AMLA_WATCHLIST_TEMPLATE,
  amlaDecisionReasonError,
  amlaMatchLines,
  amlaMatchRow,
  amlaOrderBody,
  amlaOrderLines,
  amlaOrderRow,
  amlaReleaseBody,
  amlaWatchlistFileError,
  amlaWatchlistView,
} from "./screening-view";

const ana = { id: 7, name: "Ana Cruz" };

test("the options read in the server's words", () => {
  assert.deepEqual(AMLA_MATCH_STATUS_OPTIONS, [
    { value: "pending", label: "Pending review" },
    { value: "confirmed", label: "Confirmed match" },
    { value: "cleared", label: "Cleared as a false positive" },
  ]);
  assert.deepEqual(AMLA_MATCH_SUBJECT_OPTIONS.map((o) => o.label), ["Member", "Walk-in", "Co-maker"]);
  assert.deepEqual(AMLA_ORDER_AUTHORITY_OPTIONS, [
    { value: "amlc", label: "AMLC" },
    { value: "court", label: "Court" },
    { value: "other", label: "Other authority" },
  ]);
  assert.deepEqual(AMLA_ORDER_STATUS_OPTIONS, [
    { value: "active", label: "In force" },
    { value: "released", label: "Released" },
  ]);
});

const LIST: AmlaWatchlist = {
  source: "amlc",
  source_words: "AMLC designations",
  format: "csv",
  active_version: {
    id: 3,
    source: "amlc",
    source_words: "AMLC designations",
    version_label: "Resolution 2026-12",
    entry_count: 41,
    status: "active",
    status_words: "In force",
    rescreen_pending: true,
    rescreened_at: null,
    uploaded_by: ana,
    uploaded_at: "2026-11-21T02:00:00Z",
    superseded_at: null,
  },
  versions: [],
};

test("a watchlist reads its version in force, its file kind and whether a rescreen is waiting", () => {
  assert.deepEqual(amlaWatchlistView(LIST), {
    source: "amlc",
    title: "AMLC designations",
    file: "A CSV file made from the template",
    inForce: `Resolution 2026-12: 41 entries, uploaded by Ana Cruz, ${formatDateTime("2026-11-21T02:00:00Z")}`,
    rescreen: "Everyone will be screened against it on the next screening run.",
  });
  const un = amlaWatchlistView({ ...LIST, source: "un", source_words: "UN Security Council consolidated list", format: "xml", active_version: null });
  assert.equal(un.file, "The UN consolidated list's XML file");
  assert.equal(un.inForce, "No list uploaded yet.");
  assert.equal(un.rescreen, null);
  const one = amlaWatchlistView({ ...LIST, active_version: { ...LIST.active_version!, entry_count: 1, version_label: null, rescreen_pending: false, rescreened_at: "2026-11-21T03:00:00Z" } });
  assert.equal(one.inForce, `Version #3: 1 entry, uploaded by Ana Cruz, ${formatDateTime("2026-11-21T02:00:00Z")}`);
  assert.equal(one.rescreen, `Everyone was screened against it ${formatDateTime("2026-11-21T03:00:00Z")}.`);
});

test("an upload must be the list's own kind of file, before the server checks its contents", () => {
  assert.equal(amlaWatchlistFileError("xml", "consolidated.xml"), null);
  assert.equal(amlaWatchlistFileError("xml", "consolidated.XML"), null);
  assert.equal(amlaWatchlistFileError("xml", "list.csv"), "Pick the UN consolidated list's XML file.");
  assert.equal(amlaWatchlistFileError("csv", "designations.csv"), null);
  assert.equal(amlaWatchlistFileError("csv", "designations.xlsx"), "Pick a CSV file made from the template.");
  assert.equal(amlaWatchlistFileError("csv", null), "Pick a CSV file made from the template.");
});

test("the CSV template carries exactly the columns the server reads", () => {
  assert.equal(AMLA_WATCHLIST_TEMPLATE.fileName, "watchlist-template.csv");
  assert.equal(AMLA_WATCHLIST_TEMPLATE.content, "reference,type,full_name,aliases,birth_year,nationality\n");
});

const MATCH: AmlaScreeningMatchDetail = {
  id: 5,
  status: "pending",
  status_words: "Pending review",
  score: 92,
  threshold: 85,
  subject: { type: "member", type_words: "Member", id: 7, name: "Juan Dela Cruz", code: "BRW-000007" },
  entry: {
    id: 40,
    source: "un",
    source_words: "UN Security Council consolidated list",
    reference: "QDi.123",
    kind: "individual",
    kind_words: "Individual",
    full_name: "JUAN DELA CRUZ",
    aliases: ["Juan Cruz", "J. D. Cruz"],
    birth_years: ["1980"],
    nationalities: ["Philippines"],
  },
  found_at: "2026-11-21T02:00:00Z",
  reasons: ["Every name word matches", "Birth year matches (1980)"],
  version: { id: 3, label: "2026-11-20" },
  decided_by: null,
  decided_at: null,
  decision_reason: null,
};

test("a match row reads the subject, the listing, the score against the threshold, and its status", () => {
  assert.deepEqual(amlaMatchRow(MATCH), {
    id: 5,
    href: "/amla/screening/5",
    subject: "Juan Dela Cruz",
    subjectType: "Member",
    code: "BRW-000007",
    listed: "JUAN DELA CRUZ",
    listing: "UN Security Council consolidated list · QDi.123 · Individual",
    score: "Score 92 (threshold 85)",
    status: "Pending review",
    pending: true,
    found: formatDateTime("2026-11-21T02:00:00Z"),
  });
  const gone = amlaMatchRow({ ...MATCH, subject: { ...MATCH.subject, name: null, code: null } });
  assert.equal(gone.subject, "Data not available");
  assert.equal(gone.code, "—");
});

test("a match's detail lists its reasons and the listing's details, and who decided it, never the system", () => {
  assert.deepEqual(amlaMatchLines(MATCH), {
    reasons: ["Every name word matches", "Birth year matches (1980)"],
    listing: [
      ["Also known as", "Juan Cruz; J. D. Cruz"],
      ["Birth year", "1980"],
      ["Nationality", "Philippines"],
      ["List version", "2026-11-20"],
    ],
    decided: null,
    canDecide: true,
  });
  const decided = amlaMatchLines({ ...MATCH, status: "cleared", status_words: "Cleared as a false positive", decided_by: ana, decided_at: "2026-11-21T03:00:00Z", decision_reason: "Different person: birth date on file differs." });
  assert.equal(decided.canDecide, false);
  assert.equal(decided.decided, `Cleared as a false positive by Ana Cruz, ${formatDateTime("2026-11-21T03:00:00Z")}. Reason: Different person: birth date on file differs.`);
  const bare = amlaMatchLines({ ...MATCH, entry: { ...MATCH.entry, aliases: [], birth_years: [], nationalities: [] }, version: { id: 3, label: null } });
  assert.deepEqual(bare.listing, [
    ["Also known as", "None listed"],
    ["Birth year", "Not listed"],
    ["Nationality", "Not listed"],
    ["List version", "Version #3"],
  ]);
});

test("confirming or clearing a match needs a reason, at most 2,000 characters", () => {
  assert.equal(amlaDecisionReasonError(" "), "Give the reason for the decision.");
  assert.equal(amlaDecisionReasonError("x".repeat(2001)), "Keep the reason to 2,000 characters.");
  assert.equal(amlaDecisionReasonError("Same birth date and ID"), null);
});

const ORDER: AmlaOrderDetail = {
  id: 2,
  reference: "AMLC-FO-2026-0042",
  authority: "amlc",
  authority_words: "AMLC",
  received_on: "2026-11-20",
  return_due_on: "2026-12-20",
  status: "active",
  status_words: "In force",
  member: { id: 7, name: "Juan Dela Cruz", code: "BRW-000007" },
  holds: [{ savings_hold_id: 11, account_id: 3, account_number: "SA-000003", amount: "25000.50", status: "active", status_words: "Active" }],
  placed_by: ana,
  placed_at: "2026-11-21T02:00:00Z",
  required_action: "Freeze the member's deposits.",
  details: null,
  responsible_officer: null,
  pending_release: null,
  release_requested_by: null,
  released_by: null,
  released_at: null,
  release_reason: null,
  release_reference: null,
};

test("an order row reads its reference, authority, member, dates and holds in words, with ₱ to two decimals", () => {
  assert.deepEqual(amlaOrderRow(ORDER), {
    id: 2,
    href: "/amla/orders/2",
    reference: "AMLC-FO-2026-0042",
    authority: "AMLC",
    member: "Juan Dela Cruz",
    code: "BRW-000007",
    received: formatDate("2026-11-20"),
    status: "In force",
    active: true,
    holds: ["SA-000003: ₱25,000.50 (Active)"],
  });
  assert.deepEqual(amlaOrderRow({ ...ORDER, holds: [], member: null }).holds, ["No savings holds"]);
  assert.equal(amlaOrderRow({ ...ORDER, member: null }).member, "Data not available");
});

test("an order's detail reads its action, dates, who placed it, and the release in words", () => {
  const lines = amlaOrderLines(ORDER);
  assert.deepEqual(lines.facts, [
    ["Authority", "AMLC"],
    ["Received", formatDate("2026-11-20")],
    ["Return due", formatDate("2026-12-20")],
    ["Placed", `By Ana Cruz, ${formatDateTime("2026-11-21T02:00:00Z")}`],
    ["Required action", "Freeze the member's deposits."],
  ]);
  assert.equal(lines.pending, null);
  assert.equal(lines.released, null);
  const waiting = amlaOrderLines({ ...ORDER, pending_release: { id: 4, requested_by: ana, requested_at: "2026-11-22T01:00:00Z", reason: "Lifted by the court", release_reference: "CA-G.R. 123" } });
  assert.equal(waiting.pending, `Ana Cruz asked for its release ${formatDateTime("2026-11-22T01:00:00Z")} (CA-G.R. 123): Lifted by the court. A different sanctions holder approves or rejects it.`);
  const released = amlaOrderLines({ ...ORDER, status: "released", status_words: "Released", released_by: { id: 8, name: "Ben Reyes" }, released_at: "2026-11-23T01:00:00Z", release_reason: "Lifted", release_reference: "CA-G.R. 123", release_requested_by: ana });
  assert.equal(released.released, `Released by Ben Reyes, ${formatDateTime("2026-11-23T01:00:00Z")}, as asked by Ana Cruz (CA-G.R. 123): Lifted.`);
});

const FORM = {
  reference: " AMLC-FO-2026-0042 ",
  authority: "amlc",
  receivedOn: "2026-11-20",
  memberId: 7,
  requiredAction: " Freeze deposits ",
  details: "",
  returnDueOn: "",
  holds: [{ accountId: "3", amount: " 25000.50 " }],
};

test("an order sends its fields trimmed, with each hold's account and amount as the server takes them", () => {
  assert.deepEqual(amlaOrderBody(FORM, "2026-11-21"), {
    body: {
      reference: "AMLC-FO-2026-0042",
      authority: "amlc",
      received_on: "2026-11-20",
      borrower_id: 7,
      required_action: "Freeze deposits",
      holds: [{ account_id: 3, amount: "25000.50" }],
    },
  });
  const noHolds = amlaOrderBody({ ...FORM, holds: [], details: " Case 1 ", returnDueOn: "2026-12-20" }, "2026-11-21");
  assert.ok("body" in noHolds);
  assert.deepEqual(noHolds.body.holds, []);
  assert.equal(noHolds.body.details, "Case 1");
  assert.equal(noHolds.body.return_due_on, "2026-12-20");
});

test("the order form says what is missing or wrong, in words", () => {
  const today = "2026-11-21";
  assert.deepEqual(amlaOrderBody({ ...FORM, reference: " " }, today), { error: "Give the order's reference." });
  assert.deepEqual(amlaOrderBody({ ...FORM, authority: "" }, today), { error: "Pick who issued the order." });
  assert.deepEqual(amlaOrderBody({ ...FORM, receivedOn: "" }, today), { error: "Give the date the order was received." });
  assert.deepEqual(amlaOrderBody({ ...FORM, receivedOn: "2026-11-22" }, today), { error: "The received date can't be after today." });
  assert.deepEqual(amlaOrderBody({ ...FORM, memberId: null }, today), { error: "Pick the member the order names." });
  assert.deepEqual(amlaOrderBody({ ...FORM, requiredAction: "" }, today), { error: "Say what the order requires." });
  assert.deepEqual(amlaOrderBody({ ...FORM, returnDueOn: "2026-11-19" }, today), { error: "The return date can't be before the received date." });
  assert.deepEqual(amlaOrderBody({ ...FORM, holds: [{ accountId: "", amount: "1.00" }] }, today), { error: "Pick the account for each hold." });
  assert.deepEqual(amlaOrderBody({ ...FORM, holds: [{ accountId: "3", amount: "25,000" }] }, today), {
    error: "Each hold's amount is in pesos with up to two decimals, above ₱0.00.",
  });
  assert.deepEqual(amlaOrderBody({ ...FORM, holds: [{ accountId: "3", amount: "0.00" }] }, today), {
    error: "Each hold's amount is in pesos with up to two decimals, above ₱0.00.",
  });
  assert.deepEqual(amlaOrderBody({ ...FORM, holds: [{ accountId: "3", amount: "1" }, { accountId: "3", amount: "2" }] }, today), {
    error: "Hold each account once; put the whole amount on one hold.",
  });
});

test("a release request needs its reason and the lifting order's reference", () => {
  assert.deepEqual(amlaReleaseBody({ reason: " Lifted by the court ", reference: " CA-G.R. 123 " }), {
    body: { reason: "Lifted by the court", release_reference: "CA-G.R. 123" },
  });
  assert.deepEqual(amlaReleaseBody({ reason: "", reference: "CA" }), { error: "Give the reason for the release." });
  assert.deepEqual(amlaReleaseBody({ reason: "Lifted", reference: " " }), { error: "Give the reference of the order or resolution that lifts it." });
});
