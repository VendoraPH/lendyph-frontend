import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PENDING_APPROVALS_POLL_MS,
  createPendingApprovalsPoller,
  pendingApprovalsBadgeEnabled,
} from "./use-pending-loan-approvals";

function canOnly(...granted: string[]) {
  return (permission: string) => granted.includes(permission);
}

test("an approver who reads loans but has no loans:approve still gets the badge", () => {
  // manager and bod1–bod7 own the default approval steps with loans:view only;
  // `awaiting_me` already limits the count to the user's own steps.
  assert.equal(pendingApprovalsBadgeEnabled(canOnly("loans:view")), true);
});

test("no badge read without loans:view, which GET /loans needs", () => {
  assert.equal(pendingApprovalsBadgeEnabled(canOnly("loans:approve")), false);
  assert.equal(pendingApprovalsBadgeEnabled(canOnly()), false);
});

// The sidebar's "awaiting me" badge, driven by a fake clock and fake timers:
// each read is answered by hand (`answer`) so a test decides when and how it
// settles.

type Answer = { count: number | null } | { error: unknown };

function harness(opts: { hidden?: boolean; signedIn?: boolean } = {}) {
  let hidden = opts.hidden ?? false;
  let signedIn = opts.signedIn ?? true;
  let now = Date.parse("2026-11-03T04:00:00.000Z");
  let reads = 0;
  const shown: number[] = [];
  let pending: ((answer: Answer) => void)[] = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextId = 1;
  const poller = createPendingApprovalsPoller({
    count: () => {
      reads += 1;
      return new Promise<number | null>((resolve, reject) => {
        pending.push((answer) => ("error" in answer ? reject(answer.error) : resolve(answer.count)));
      });
    },
    onCount: (n) => shown.push(n),
    isHidden: () => hidden,
    hasSession: () => signedIn,
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
    shown,
    get reads() {
      return reads;
    },
    get timers() {
      return [...timers.values()];
    },
    setHidden: (h: boolean) => {
      hidden = h;
    },
    setSignedIn: (v: boolean) => {
      signedIn = v;
    },
    advance: (ms: number) => {
      now += ms;
    },
    /** Answer every read in flight, then let the poller's handlers run. */
    answer: async (answer: Answer) => {
      const settling = pending;
      pending = [];
      for (const done of settling) done(answer);
      await new Promise((r) => setImmediate(r));
    },
    tick: () => {
      for (const t of timers.values()) t.fn();
    },
  };
}

const UNAUTHORIZED = { response: { status: 401 } };

describe("createPendingApprovalsPoller", () => {
  test("reads at once, shows the count, and reads again every 2 minutes", async () => {
    const h = harness();
    h.poller.start();
    await h.answer({ count: 3 });
    assert.equal(h.reads, 1);
    assert.deepEqual(h.shown, [3]);
    assert.equal(PENDING_APPROVALS_POLL_MS, 120_000);
    assert.equal(h.timers.length, 1);
    assert.equal(h.timers[0].ms, PENDING_APPROVALS_POLL_MS);

    h.advance(PENDING_APPROVALS_POLL_MS);
    h.tick();
    await h.answer({ count: 4 });
    assert.equal(h.reads, 2);
    assert.deepEqual(h.shown, [3, 4]);
  });

  test("a 401 stops it for good: no interval, and no read on a tick, focus or a shown tab", async () => {
    const h = harness();
    h.poller.start();
    await h.answer({ error: UNAUTHORIZED });
    assert.equal(h.reads, 1);
    assert.equal(h.timers.length, 0);

    h.advance(10 * PENDING_APPROVALS_POLL_MS);
    h.tick();
    h.poller.handleFocus();
    h.setHidden(true);
    h.poller.handleVisibilityChange();
    h.setHidden(false);
    h.poller.handleVisibilityChange();
    await h.answer({ count: 9 });
    assert.equal(h.reads, 1);
    assert.equal(h.timers.length, 0);
    assert.deepEqual(h.shown, []);
  });

  test("any other failure keeps the last figure and keeps polling", async () => {
    const h = harness();
    h.poller.start();
    await h.answer({ count: 2 });
    h.advance(PENDING_APPROVALS_POLL_MS);
    h.tick();
    await h.answer({ error: { response: { status: 500 } } });
    h.advance(PENDING_APPROVALS_POLL_MS);
    h.tick();
    await h.answer({ error: new Error("offline") });
    assert.deepEqual(h.shown, [2]);
    assert.equal(h.timers.length, 1);

    h.advance(PENDING_APPROVALS_POLL_MS);
    h.tick();
    await h.answer({ count: 5 });
    assert.equal(h.reads, 4);
    assert.deepEqual(h.shown, [2, 5]);
  });

  test("a read without a total keeps the last figure", async () => {
    const h = harness();
    h.poller.start();
    await h.answer({ count: 1 });
    h.advance(PENDING_APPROVALS_POLL_MS);
    h.tick();
    await h.answer({ count: null });
    assert.deepEqual(h.shown, [1]);
  });

  test("with no access token stored it neither reads nor schedules", async () => {
    const h = harness({ signedIn: false });
    h.poller.start();
    await h.answer({ count: 1 });
    assert.equal(h.reads, 0);
    assert.equal(h.timers.length, 0);
  });

  test("once the token is gone the next tick reads nothing and the interval stops", async () => {
    const h = harness();
    h.poller.start();
    await h.answer({ count: 1 });
    h.setSignedIn(false);
    h.advance(PENDING_APPROVALS_POLL_MS);
    h.tick();
    await h.answer({ count: 7 });
    assert.equal(h.reads, 1);
    assert.equal(h.timers.length, 0);
    assert.deepEqual(h.shown, [1]);
  });

  test("a hidden tab makes no reads, and showing it catches up", async () => {
    const h = harness({ hidden: true });
    h.poller.start();
    assert.equal(h.reads, 0);
    assert.equal(h.timers.length, 0);
    h.setHidden(false);
    h.poller.handleVisibilityChange();
    await h.answer({ count: 6 });
    assert.equal(h.reads, 1);
    assert.equal(h.timers.length, 1);
    assert.deepEqual(h.shown, [6]);
  });
});
