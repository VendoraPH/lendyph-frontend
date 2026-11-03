import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  FEED_LIMIT,
  UNREAD_MIN_GAP_MS,
  UNREAD_POLL_MS,
  bellAccessibleName,
  buildFeed,
  createUnreadPoller,
  formatRelativeTime,
  markAllRead,
  markOneRead,
  notificationTone,
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

// ── The poller, driven by a fake clock and fake timers ──────────────────────

function harness(opts: { hidden?: boolean; fail?: boolean } = {}) {
  let hidden = opts.hidden ?? false;
  let now = NOW;
  let loads = 0;
  let pending: (() => void) | null = null;
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextId = 1;
  const poller = createUnreadPoller({
    load: () => {
      loads += 1;
      return new Promise<void>((resolve, reject) => {
        pending = () => (opts.fail ? reject(new Error("offline")) : resolve());
      });
    },
    isHidden: () => hidden,
    now: () => now,
    setInterval: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearInterval: (h) => {
      timers.delete(h as number);
    },
  });
  return {
    poller,
    get loads() {
      return loads;
    },
    get timers() {
      return [...timers.values()];
    },
    setHidden: (h: boolean) => {
      hidden = h;
    },
    advance: (ms: number) => {
      now += ms;
    },
    /** Settle the read in flight and let its `finally` run. */
    settle: async () => {
      pending?.();
      pending = null;
      await new Promise((r) => setImmediate(r));
    },
    tick: () => {
      for (const t of timers.values()) t.fn();
    },
  };
}

describe("createUnreadPoller", () => {
  test("starting reads at once and schedules a read every 60 s", async () => {
    const h = harness();
    h.poller.start();
    await h.settle();
    assert.equal(h.loads, 1);
    assert.equal(h.timers.length, 1);
    assert.equal(h.timers[0].ms, UNREAD_POLL_MS);
    assert.equal(UNREAD_POLL_MS, 60_000);
    h.advance(UNREAD_POLL_MS);
    h.tick();
    await h.settle();
    assert.equal(h.loads, 2);
  });

  test("a hidden tab neither reads nor schedules", async () => {
    const h = harness({ hidden: true });
    h.poller.start();
    await h.settle();
    assert.equal(h.loads, 0);
    assert.equal(h.timers.length, 0);
  });

  test("hiding the tab stops polling; showing it reads again and resumes", async () => {
    const h = harness();
    h.poller.start();
    await h.settle();
    h.setHidden(true);
    h.poller.handleVisibilityChange();
    assert.equal(h.timers.length, 0);
    h.advance(5 * UNREAD_POLL_MS);
    h.setHidden(false);
    h.poller.handleVisibilityChange();
    await h.settle();
    assert.equal(h.loads, 2);
    assert.equal(h.timers.length, 1);
  });

  test("regaining focus reads again and restarts the interval", async () => {
    const h = harness();
    h.poller.start();
    await h.settle();
    h.advance(30_000);
    h.poller.handleFocus();
    await h.settle();
    assert.equal(h.loads, 2);
    assert.equal(h.timers.length, 1, "one interval, never two");
  });

  test("focus and visibilitychange together make one read, not two", async () => {
    const h = harness();
    h.poller.start();
    await h.settle();
    h.advance(UNREAD_POLL_MS);
    h.poller.handleVisibilityChange();
    await h.settle();
    h.advance(UNREAD_MIN_GAP_MS - 1);
    h.poller.handleFocus();
    await h.settle();
    assert.equal(h.loads, 2);
    assert.equal(h.timers.length, 1);
  });

  test("a read still in flight is not doubled", async () => {
    const h = harness();
    h.poller.start();
    h.advance(UNREAD_POLL_MS);
    h.tick();
    assert.equal(h.loads, 1);
    await h.settle();
    h.tick();
    assert.equal(h.loads, 2);
  });

  test("a failed read is swallowed and the next tick reads again", async () => {
    const h = harness({ fail: true });
    h.poller.start();
    await h.settle();
    h.advance(UNREAD_POLL_MS);
    h.tick();
    await h.settle();
    assert.equal(h.loads, 2);
  });

  test("refresh reads outside the schedule, even inside the focus gap", async () => {
    const h = harness();
    h.poller.start();
    await h.settle();
    h.poller.refresh();
    await h.settle();
    assert.equal(h.loads, 2);
  });

  test("after dispose (signed out) nothing reads, even a late event", async () => {
    const h = harness();
    h.poller.start();
    await h.settle();
    h.poller.dispose();
    assert.equal(h.timers.length, 0);
    h.advance(UNREAD_POLL_MS);
    h.poller.handleFocus();
    h.poller.handleVisibilityChange();
    h.poller.refresh();
    h.poller.start();
    await h.settle();
    assert.equal(h.loads, 1);
    assert.equal(h.timers.length, 0);
  });
});

// ── The list ────────────────────────────────────────────────────────────────

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
});
