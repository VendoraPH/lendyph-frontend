import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  FEED_LIMIT,
  bellAccessibleName,
  bellOwnerKey,
  buildFeed,
  combineFeedPages,
  createMutationGate,
  createTrailingCall,
  formatRelativeTime,
  listReplyOutcome,
  SETTLE_REFRESH_DELAY_MS,
  markAllRead,
  markOneRead,
  needsReadTopUp,
  notificationTone,
  notificationTypeLabel,
  revertReadAt,
  safeAppPath,
  unreadBadgeLabel,
} from "./notification-feed";
import type { AppNotification } from "@/types/notification";

const NOW = Date.parse("2026-11-03T04:00:00.000Z");

function row(over: Partial<AppNotification> & { id: string }): AppNotification {
  return {
    type: "loan_released",
    title: "Loan released",
    body: null,
    url: "/loans/1",
    read_at: null,
    created_at: "2026-11-03T03:00:00.000Z",
    data: null,
    ...over,
  };
}

// ── Optimistic changes vs. count reads already on the wire (M1) ─────────────

describe("createMutationGate", () => {
  test("with no change, a read's answer is shown", () => {
    const gate = createMutationGate();
    assert.equal(gate.accepts(gate.token()), true);
    assert.equal(gate.idle(), true);
  });

  test("a read that started before a mark-read is dropped, even after it settles", () => {
    const gate = createMutationGate();
    const before = gate.token();
    const settle = gate.begin();
    assert.equal(gate.accepts(before), false, "mark-read on the wire");
    settle();
    assert.equal(gate.accepts(before), false, "the read may predate the change");
  });

  test("a read that started while a mark-read is on the wire is dropped", () => {
    const gate = createMutationGate();
    const settle = gate.begin();
    const during = gate.token();
    assert.equal(gate.accepts(during), false);
    settle();
    assert.equal(gate.accepts(during), false);
  });

  test("the refresh after the change settles is shown", () => {
    const gate = createMutationGate();
    gate.begin()();
    assert.equal(gate.accepts(gate.token()), true);
  });

  test("overlapping changes: nothing is shown until the last settles", () => {
    const gate = createMutationGate();
    const settleOne = gate.begin();
    const settleAll = gate.begin();
    settleOne();
    const afterFirst = gate.token();
    assert.equal(gate.accepts(afterFirst), false, "mark all still on the wire");
    settleAll();
    assert.equal(gate.accepts(afterFirst), false);
    assert.equal(gate.accepts(gate.token()), true);
  });

  test("settling twice counts once", () => {
    const gate = createMutationGate();
    const settleA = gate.begin();
    const settleB = gate.begin();
    settleA();
    settleA();
    assert.equal(gate.accepts(gate.token()), false, "B is still on the wire");
    settleB();
    assert.equal(gate.accepts(gate.token()), true);
  });

  test("the stale-badge race: mark all, then a pre-change read answers 3", () => {
    const gate = createMutationGate();
    let shown: number | null = 3;
    const show = (token: number, n: number) => {
      if (gate.accepts(token)) shown = n;
    };
    const staleRead = gate.token();
    const settle = gate.begin();
    shown = 0;
    show(staleRead, 3);
    assert.equal(shown, 0, "the stale 3 does not overwrite the optimistic 0");
    settle();
    const refresh = gate.token();
    show(refresh, 0);
    assert.equal(shown, 0);
  });
});

describe("list replies vs. mark-reads", () => {
  test("a list reply from before a mark-read is dropped; the read row stays read", () => {
    const gate = createMutationGate();
    let rows = [row({ id: "a" }), row({ id: "b" })];
    const listToken = gate.token();
    const settle = gate.begin();
    rows = markOneRead(rows, "a", "2026-11-03T04:00:00Z").rows;
    settle();
    const reply = [row({ id: "a" }), row({ id: "b" })];
    const outcome = listReplyOutcome(gate, listToken);
    assert.deepEqual(outcome, { apply: false, stale: true });
    if (outcome.apply) rows = reply;
    assert.equal(rows[0].read_at, "2026-11-03T04:00:00Z", "the stale reply did not put it back as unread");
    assert.equal(gate.idle(), true, "settled, so the stale list can be read again now");
  });

  test("a list reply that started during a mark-read is dropped too", () => {
    const gate = createMutationGate();
    const settle = gate.begin();
    const token = gate.token();
    assert.equal(gate.idle(), false);
    assert.deepEqual(listReplyOutcome(gate, token), { apply: false, stale: true });
    settle();
    assert.deepEqual(listReplyOutcome(gate, token), { apply: false, stale: true });
  });

  test("the reload after the change settles is applied", () => {
    const gate = createMutationGate();
    gate.begin()();
    assert.deepEqual(listReplyOutcome(gate, gate.token()), { apply: true, stale: false });
  });
});

describe("createTrailingCall", () => {
  function fakeTimers() {
    const timers = new Map<number, { fn: () => void; ms: number }>();
    let next = 1;
    return {
      timers,
      setTimeout: (fn: () => void, ms: number) => {
        const id = next++;
        timers.set(id, { fn, ms });
        return id;
      },
      clearTimeout: (h: unknown) => {
        timers.delete(h as number);
      },
      fire: () => {
        const due = [...timers.entries()];
        timers.clear();
        for (const [, t] of due) t.fn();
      },
    };
  }

  test("rapid mark-reads settle into one refresh, 300 ms after the last", () => {
    const t = fakeTimers();
    let calls = 0;
    const trailing = createTrailingCall(() => (calls += 1), SETTLE_REFRESH_DELAY_MS, t);
    trailing.schedule();
    trailing.schedule();
    trailing.schedule();
    assert.equal(t.timers.size, 1, "one pending refresh, not three");
    assert.equal([...t.timers.values()][0].ms, 300);
    assert.equal(calls, 0);
    t.fire();
    assert.equal(calls, 1);
    trailing.schedule();
    t.fire();
    assert.equal(calls, 2, "a later settle schedules again");
  });

  test("cancel (unmount) drops the pending refresh", () => {
    const t = fakeTimers();
    let calls = 0;
    const trailing = createTrailingCall(() => (calls += 1), SETTLE_REFRESH_DELAY_MS, t);
    trailing.schedule();
    trailing.cancel();
    t.fire();
    assert.equal(calls, 0);
    assert.equal(t.timers.size, 0);
  });
});

describe("revertReadAt", () => {
  test("puts back only the rows the change stamped", () => {
    const stamp = "2026-11-03T04:00:00.000Z";
    const rows = [
      row({ id: "a", read_at: stamp }),
      row({ id: "b", read_at: "2026-11-01T00:00:00Z" }),
      row({ id: "c", read_at: stamp }),
    ];
    const next = revertReadAt(rows, new Set(["a", "b"]), stamp);
    assert.deepEqual(
      next.map((r) => r.read_at),
      [null, "2026-11-01T00:00:00Z", stamp],
    );
    assert.equal(rows[0].read_at, stamp, "the input is not mutated");
  });

  test("a row read again since (a newer stamp) is left alone", () => {
    const next = revertReadAt([row({ id: "a", read_at: "2026-11-03T05:00:00Z" })], new Set(["a"]), "2026-11-03T04:00:00Z");
    assert.equal(next[0].read_at, "2026-11-03T05:00:00Z");
  });
});

describe("bellOwnerKey (L2)", () => {
  test("signed out, and each user, get their own key", () => {
    assert.equal(bellOwnerKey(null), "signed-out");
    assert.equal(bellOwnerKey(undefined), "signed-out");
    assert.equal(bellOwnerKey({ id: 7 }), "user:7");
    assert.notEqual(bellOwnerKey({ id: 7 }), bellOwnerKey({ id: 8 }));
    assert.notEqual(bellOwnerKey({ id: 7 }), bellOwnerKey(null));
  });
});

// ── The list ────────────────────────────────────────────────────────────────

describe("unread first, topped up with read rows (L3)", () => {
  const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

  test("a top-up is needed only when fewer than 20 are unread", () => {
    assert.equal(needsReadTopUp([]), true);
    assert.equal(needsReadTopUp(null), true);
    assert.equal(needsReadTopUp(Array.from({ length: 19 }, (_, i) => row({ id: `u${i}` }))), true);
    assert.equal(needsReadTopUp(Array.from({ length: 20 }, (_, i) => row({ id: `u${i}` }))), false);
  });

  test("an older unread row stays on the list behind 20 newer read ones", () => {
    const unread = [row({ id: "old", created_at: minutesAgo(3 * 24 * 60) })];
    const latest = Array.from({ length: 20 }, (_, i) =>
      row({ id: `r${i}`, created_at: minutesAgo(i + 1), read_at: minutesAgo(0) }),
    );
    const feed = buildFeed(combineFeedPages(unread, latest), NOW);
    assert.equal(feed.length, 20);
    assert.equal(feed[0].id, "old");
    assert.equal(feed[0].unread, true);
    assert.deepEqual(feed.slice(1).map((f) => f.id), latest.slice(0, 19).map((r) => r.id));
  });

  test("a row on both pages is listed once, as unread", () => {
    const shared = row({ id: "s", created_at: minutesAgo(5) });
    const feed = buildFeed(
      combineFeedPages([shared], [shared, row({ id: "r", created_at: minutesAgo(1), read_at: minutesAgo(0) })]),
      NOW,
    );
    assert.deepEqual(feed.map((f) => [f.id, f.unread]), [["s", true], ["r", false]]);
  });

  test("20 unread fill the list; a missing top-up page is just no read rows", () => {
    const unread = Array.from({ length: 20 }, (_, i) => row({ id: `u${i}`, created_at: minutesAgo(i) }));
    assert.equal(buildFeed(combineFeedPages(unread, null), NOW).length, 20);
    assert.deepEqual(combineFeedPages(null, undefined), []);
  });
});

describe("buildFeed", () => {
  test("unread first, newest first within each group", () => {
    const feed = buildFeed(
      [
        row({ id: "a", created_at: "2026-11-03T03:50:00Z", read_at: "2026-11-03T03:55:00Z" }),
        row({ id: "b", created_at: "2026-11-03T01:00:00Z" }),
        row({ id: "c", created_at: "2026-11-03T03:00:00Z" }),
        row({ id: "d", created_at: "2026-11-02T03:00:00Z", read_at: "2026-11-02T04:00:00Z" }),
      ],
      NOW,
    );
    assert.deepEqual(
      feed.map((f) => [f.id, f.unread]),
      [
        ["c", true],
        ["b", true],
        ["a", false],
        ["d", false],
      ],
    );
  });

  test("at most 20 rows", () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      row({ id: `n${i}`, created_at: new Date(NOW - i * 60_000).toISOString() }),
    );
    const feed = buildFeed(rows, NOW);
    assert.equal(FEED_LIMIT, 20);
    assert.equal(feed.length, 20);
    assert.equal(feed[0].id, "n0");
  });

  test("₱ amounts in title and body pass through exactly as sent", () => {
    const [item] = buildFeed(
      [
        row({
          id: "p",
          type: "payment_voided",
          title: "Payment of ₱1,500.00 voided",
          body: "Receipt RCP-000003 on loan LN-2026-0007 (₱10.50 penalty restored).",
        }),
      ],
      NOW,
    );
    assert.equal(item.title, "Payment of ₱1,500.00 voided");
    assert.equal(item.body, "Receipt RCP-000003 on loan LN-2026-0007 (₱10.50 penalty restored).");
    assert.equal(item.tone, "danger");
  });

  test("maps url, relative time and an empty body", () => {
    const [item] = buildFeed([row({ id: "x", body: "", url: "/loans/7" })], NOW);
    assert.equal(item.href, "/loans/7");
    assert.equal(item.body, null);
    assert.equal(item.relativeTime, "1 hour ago");
    assert.equal(item.createdAt, "2026-11-03T03:00:00.000Z");
  });

  test("drops rows without an id and lists a repeated id once", () => {
    const feed = buildFeed(
      [row({ id: "" }), row({ id: "k" }), row({ id: "k", title: "dupe" })],
      NOW,
    );
    assert.deepEqual(
      feed.map((f) => [f.id, f.title]),
      [["k", "Loan released"]],
    );
  });

  test("a missing or malformed list is an empty feed", () => {
    assert.deepEqual(buildFeed(null, NOW), []);
    assert.deepEqual(buildFeed(undefined, NOW), []);
    assert.deepEqual(buildFeed({} as unknown as AppNotification[], NOW), []);
  });

  test("an unreadable created_at sorts last in its group and shows no time", () => {
    const feed = buildFeed(
      [row({ id: "bad", created_at: "not a date" }), row({ id: "ok" })],
      NOW,
    );
    assert.deepEqual(feed.map((f) => f.id), ["ok", "bad"]);
    assert.equal(feed[1].relativeTime, "");
  });
});

describe("safeAppPath", () => {
  test("keeps in-app paths", () => {
    assert.equal(safeAppPath("/loans/12"), "/loans/12");
    assert.equal(safeAppPath("/loans/12?tab=ledger"), "/loans/12?tab=ledger");
    assert.equal(safeAppPath("  /loans/12\n"), "/loans/12", "surrounding whitespace is trimmed");
  });

  test("refuses anything that leaves the app", () => {
    for (const url of [
      "https://evil.example/loans/1",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "loans/1",
      "/loans\u00001",
      "",
      null,
      undefined,
    ]) {
      assert.equal(safeAppPath(url as string | null | undefined), null, String(url));
    }
  });
});

describe("formatRelativeTime", () => {
  const ago = (ms: number) => new Date(NOW - ms).toISOString();

  test("minutes, hours and days", () => {
    assert.equal(formatRelativeTime(ago(10_000), NOW), "Just now");
    assert.equal(formatRelativeTime(ago(60_000), NOW), "1 minute ago");
    assert.equal(formatRelativeTime(ago(5 * 60_000), NOW), "5 minutes ago");
    assert.equal(formatRelativeTime(ago(60 * 60_000), NOW), "1 hour ago");
    assert.equal(formatRelativeTime(ago(23 * 60 * 60_000), NOW), "23 hours ago");
    assert.equal(formatRelativeTime(ago(24 * 60 * 60_000), NOW), "1 day ago");
    assert.equal(formatRelativeTime(ago(6 * 24 * 60 * 60_000), NOW), "6 days ago");
  });

  test("a week or older shows the date", () => {
    const iso = ago(8 * 24 * 60 * 60_000);
    const text = formatRelativeTime(iso, NOW);
    assert.match(text, /2026/);
    assert.doesNotMatch(text, /ago/);
  });

  test("clock skew reads Just now; unreadable reads empty", () => {
    assert.equal(formatRelativeTime(new Date(NOW + 30_000).toISOString(), NOW), "Just now");
    assert.equal(formatRelativeTime("nope", NOW), "");
    assert.equal(formatRelativeTime(null, NOW), "");
  });
});

describe("optimistic read state", () => {
  test("markOneRead marks only that row and says whether it was unread", () => {
    const rows = [row({ id: "a" }), row({ id: "b" })];
    const { rows: next, wasUnread } = markOneRead(rows, "a", "2026-11-03T04:00:00Z");
    assert.equal(wasUnread, true);
    assert.equal(next[0].read_at, "2026-11-03T04:00:00Z");
    assert.equal(next[1].read_at, null);
    assert.equal(rows[0].read_at, null, "the input is not mutated");
  });

  test("markOneRead on a read or unknown row changes nothing", () => {
    const rows = [row({ id: "a", read_at: "2026-11-01T00:00:00Z" })];
    assert.equal(markOneRead(rows, "a", "x").wasUnread, false);
    assert.equal(markOneRead(rows, "a", "x").rows[0].read_at, "2026-11-01T00:00:00Z");
    assert.equal(markOneRead(rows, "zzz", "x").wasUnread, false);
  });

  test("markAllRead keeps earlier read times", () => {
    const next = markAllRead(
      [row({ id: "a" }), row({ id: "b", read_at: "2026-11-01T00:00:00Z" })],
      "2026-11-03T04:00:00Z",
    );
    assert.deepEqual(
      next.map((r) => r.read_at),
      ["2026-11-03T04:00:00Z", "2026-11-01T00:00:00Z"],
    );
  });
});

describe("badge and labels", () => {
  test("badge text", () => {
    assert.equal(unreadBadgeLabel(0), null);
    assert.equal(unreadBadgeLabel(null), null);
    assert.equal(unreadBadgeLabel(Number.NaN), null);
    assert.equal(unreadBadgeLabel(3), "3");
    assert.equal(unreadBadgeLabel(9), "9");
    assert.equal(unreadBadgeLabel(10), "9+");
  });

  test("accessible name carries the full count", () => {
    assert.equal(bellAccessibleName(0), "Notifications");
    assert.equal(bellAccessibleName(null), "Notifications");
    assert.equal(bellAccessibleName(42), "Notifications, 42 unread");
  });

  test("tone per type; an unknown type is info", () => {
    assert.equal(notificationTone("approval_needed"), "approval");
    assert.equal(notificationTone("adjustment_pending"), "approval");
    assert.equal(notificationTone("loan_approved"), "success");
    assert.equal(notificationTone("loan_released"), "success");
    assert.equal(notificationTone("loan_rejected"), "danger");
    assert.equal(notificationTone("payment_voided"), "danger");
    assert.equal(notificationTone("loan_sent_back"), "warning");
    assert.equal(notificationTone("loan_past_due"), "warning");
    assert.equal(notificationTone("extension_applied"), "info");
    assert.equal(notificationTone("restructure_applied"), "info");
    assert.equal(notificationTone("something_new"), "info");
  });

  // Reminders staff notices (backend #232): a bad contact and a long-overdue
  // follow-up need someone to act; a reminder that could not go out failed.
  test("reminder notices: contact invalid and follow up warn, failed is danger", () => {
    assert.equal(notificationTone("reminder_contact_invalid"), "warning");
    assert.equal(notificationTone("reminder_follow_up"), "warning");
    assert.equal(notificationTone("reminder_failed"), "danger");
  });
});

describe("savings notifications", () => {
  test("the two savings kinds read in words and take their tone", () => {
    assert.equal(notificationTypeLabel("savings_gl_difference"), "Savings books don't match the savings records");
    assert.equal(notificationTypeLabel("savings_large_transaction"), "Large savings transaction");
    assert.equal(notificationTone("savings_gl_difference"), "danger");
    assert.equal(notificationTone("savings_large_transaction"), "warning");
  });

  test("an unknown kind reads as a plain notification, never its key", () => {
    assert.equal(notificationTypeLabel("something_new"), "Notification");
  });

  test("a row without a title shows its kind in words", () => {
    const [item] = buildFeed([row({ id: "n1", type: "savings_large_transaction", title: "" })], NOW);
    assert.equal(item.title, "Large savings transaction");
    assert.equal(item.kind, "Large savings transaction");
  });
});

// The savings servicing notice keys (backend S4: ApprovalWaitingNotice,
// NightlyNotices and AccountEventNotices).
describe("savings servicing notifications", () => {
  const SERVICING_KINDS: Record<string, [string, string]> = {
    savings_approval_waiting: ["Savings approval waiting", "approval"],
    savings_time_deposit_maturing: ["Time deposit maturing", "info"],
    savings_dormancy_warning: ["Savings account dormant soon", "warning"],
    savings_account_dormant: ["Savings account dormant", "warning"],
  };

  for (const [type, [label, tone]] of Object.entries(SERVICING_KINDS)) {
    test(`${type} reads "${label}" and is ${tone}`, () => {
      assert.equal(notificationTypeLabel(type), label);
      assert.equal(notificationTone(type), tone);
    });
  }

  test("the second checker's notice keeps the server's title and reads it once", () => {
    const [item] = buildFeed(
      [
        row({
          id: "s1",
          type: "savings_approval_waiting",
          title: "Second savings approval waiting",
          url: "/savings/approvals",
          data: { approval_id: 8, kind: "withdrawal", checkers_left: 1 },
        }),
      ],
      NOW,
    );
    assert.equal(item.title, "Second savings approval waiting");
    assert.equal(item.kind, "Savings approval waiting");
    assert.equal(item.announceKind, false);
    assert.equal(item.href, "/savings/approvals");
  });

  // Gap round B7: `data.stage` says which approval it is, not `checkers_left`.
  test("a notice with no title reads its stage: the first approval or the second checker", () => {
    const [second, first, older] = buildFeed(
      [
        row({ id: "s3", type: "savings_approval_waiting", title: "", data: { approval_id: 9, stage: "second", checkers_left: 1 } }),
        row({ id: "s4", type: "savings_approval_waiting", title: "", data: { approval_id: 10, stage: "first", checkers_left: 1 } }),
        row({ id: "s5", type: "savings_approval_waiting", title: "", data: { approval_id: 11, checkers_left: 1 } }),
      ],
      NOW,
    );
    assert.equal(second.title, "Second savings approval waiting");
    assert.equal(first.title, "Savings approval waiting");
    assert.equal(older.title, "Savings approval waiting");
    assert.equal(second.kind, "Savings approval waiting");
  });

  test("a maturing deposit due today opens the deposit and names itself once", () => {
    const [item] = buildFeed(
      [row({ id: "s2", type: "savings_time_deposit_maturing", title: "Time deposit matures today", url: "/savings/time-deposits/4" })],
      NOW,
    );
    assert.equal(item.href, "/savings/time-deposits/4");
    assert.equal(item.announceKind, false);
  });
});

// The CDA notice keys the backend sends: C2's WorkflowNotices, C4's
// DeadlineReminders and C3's RegisterNotices.
describe("CDA notifications", () => {
  const CDA_KINDS: Record<string, [string, string]> = {
    cda_approval_needed: ["CDA report awaiting approval", "approval"],
    cda_report_returned: ["CDA report returned", "warning"],
    cda_report_finalized: ["CDA report finalized", "success"],
    cda_report_for_correction: ["CDA report needs correction", "danger"],
    cda_deadline_reminder: ["CDA deadline reminder", "warning"],
    cda_document_expiring: ["CDA document expiring", "warning"],
    cda_training_incomplete: ["Officer training incomplete", "warning"],
    // Gap round B6.
    cda_submission_recorded: ["CDA submission recorded", "success"],
    cda_missing_requirement: ["CDA missing requirement", "warning"],
  };

  for (const [type, [label, tone]] of Object.entries(CDA_KINDS)) {
    test(`${type} reads "${label}" and is ${tone}`, () => {
      assert.equal(notificationTypeLabel(type), label);
      assert.equal(notificationTone(type), tone);
    });
  }
});

// The Member Portal's staff notices (backend RequestAlerts and PortalStaffAlerts).
describe("Member Portal notifications", () => {
  const PORTAL_KINDS: Record<string, [string, string]> = {
    portal_request_submitted: ["New member portal request", "approval"],
    portal_login_reported: ["Portal sign-in reported", "warning"],
  };

  for (const [type, [label, tone]] of Object.entries(PORTAL_KINDS)) {
    test(`${type} reads "${label}" and is ${tone}`, () => {
      assert.equal(notificationTypeLabel(type), label);
      assert.equal(notificationTone(type), tone);
    });
  }

  test("a request notice opens the request in the staff queue, and reads its title once", () => {
    const [item] = buildFeed(
      [row({ id: "p1", type: "portal_request_submitted", title: "New member portal request", url: "/member-portal/requests/12" })],
      NOW,
    );
    assert.equal(item.href, "/member-portal/requests/12");
    assert.equal(item.announceKind, false);
  });
});

describe("a notice reads its title once", () => {
  test("a CDA notice's server title already names its kind, so the kind isn't announced again", () => {
    const [item] = buildFeed([row({ id: "c1", type: "cda_deadline_reminder", title: "CDA report due in 3 days" })], NOW);
    assert.equal(item.title, "CDA report due in 3 days");
    assert.equal(item.announceKind, false);
  });

  test("the B6 notices' server titles name their kind too", () => {
    for (const [type, title] of [
      ["cda_submission_recorded", "CDA filing recorded"],
      ["cda_missing_requirement", "CDA report incomplete"],
    ]) {
      const [item] = buildFeed([row({ id: type, type, title })], NOW);
      assert.equal(item.announceKind, false, type);
    }
  });

  test("a row whose title is its kind doesn't announce it twice", () => {
    const [item] = buildFeed([row({ id: "n2", type: "savings_large_transaction", title: "" })], NOW);
    assert.equal(item.announceKind, false);
  });

  test("other kinds still name the kind beside a title of the server's own", () => {
    const [item] = buildFeed([row({ id: "n3", type: "loan_approved", title: "LN-000123 approved" })], NOW);
    assert.equal(item.announceKind, true);
  });
});

describe("the ready-for-release notice", () => {
  test('reads "Ready for release" and asks for action', () => {
    assert.equal(notificationTypeLabel("loan_ready_for_release"), "Ready for release");
    assert.equal(notificationTone("loan_ready_for_release"), "approval");
  });

  test("links to the loan, and its title already names the kind", () => {
    const [item] = buildFeed(
      [row({ id: "r1", type: "loan_ready_for_release", title: "Loan ready for release", url: "/loans/12" })],
      NOW,
    );
    assert.equal(item.kind, "Ready for release");
    assert.equal(item.href, "/loans/12");
    assert.equal(item.announceKind, false);
  });
});
