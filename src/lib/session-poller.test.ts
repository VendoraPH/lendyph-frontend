import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  UNREAD_MIN_GAP_MS,
  UNREAD_POLL_MS,
  createUnreadPoller,
  isUnauthorizedError,
} from "./session-poller";

const NOW = Date.parse("2026-11-03T04:00:00.000Z");

// ── The poller, driven by a fake clock and fake timers ──────────────────────

function harness(opts: { hidden?: boolean; fail?: boolean; failWith?: unknown; signedIn?: boolean } = {}) {
  let hidden = opts.hidden ?? false;
  let signedIn = opts.signedIn ?? true;
  let now = NOW;
  let loads = 0;
  let pending: (() => void)[] = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextId = 1;
  const poller = createUnreadPoller({
    load: () => {
      loads += 1;
      return new Promise<void>((resolve, reject) => {
        pending.push(() =>
          opts.failWith !== undefined
            ? reject(opts.failWith)
            : opts.fail
              ? reject(new Error("offline"))
              : resolve(),
        );
      });
    },
    isHidden: () => hidden,
    hasSession: () => signedIn,
    isSessionEnded: isUnauthorizedError,
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
    setSignedIn: (v: boolean) => {
      signedIn = v;
    },
    advance: (ms: number) => {
      now += ms;
    },
    /** Settle every read in flight and let their `finally` run. */
    settle: async () => {
      const settling = pending;
      pending = [];
      for (const done of settling) done();
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

  test("refresh starts a new read even with one in flight; a tick does not", async () => {
    const h = harness();
    h.poller.start();
    h.poller.refresh();
    assert.equal(h.loads, 2, "a mark-read settling must not wait for the older read");
    h.tick();
    assert.equal(h.loads, 2, "the schedule still skips while reads are in flight");
    await h.settle();
    h.tick();
    assert.equal(h.loads, 3, "both reads settled, so the schedule resumes");
  });

  test("a read that never settles holds scheduled reads (why the count call has a timeout)", async () => {
    const h = harness();
    h.poller.start();
    h.tick();
    h.tick();
    assert.equal(h.loads, 1);
  });

  test("no access token: nothing reads and nothing is scheduled", async () => {
    const h = harness({ signedIn: false });
    h.poller.start();
    h.poller.handleFocus();
    h.poller.handleVisibilityChange();
    h.poller.refresh();
    await h.settle();
    assert.equal(h.loads, 0);
    assert.equal(h.timers.length, 0);
  });

  test("the token is cleared (session expired): the next tick stops the poll; focus doesn't restart it", async () => {
    const h = harness();
    h.poller.start();
    await h.settle();
    h.setSignedIn(false);
    h.advance(UNREAD_POLL_MS);
    h.tick();
    assert.equal(h.loads, 1, "no read without a token");
    assert.equal(h.timers.length, 0, "the interval stopped");
    h.advance(UNREAD_POLL_MS);
    h.poller.handleFocus();
    h.setHidden(true);
    h.poller.handleVisibilityChange();
    h.setHidden(false);
    h.poller.handleVisibilityChange();
    await h.settle();
    assert.equal(h.loads, 1);
    assert.equal(h.timers.length, 0);
  });

  test("a 401 halts the poll for good, even if a token shows up again", async () => {
    const h = harness({ failWith: { response: { status: 401 } } });
    h.poller.start();
    await h.settle();
    assert.equal(h.timers.length, 0, "halted");
    h.advance(UNREAD_POLL_MS);
    h.tick();
    h.poller.handleFocus();
    h.poller.handleVisibilityChange();
    h.poller.refresh();
    h.poller.start();
    await h.settle();
    assert.equal(h.loads, 1);
    assert.equal(h.timers.length, 0);
  });

  test("other failures (500, offline) keep polling", async () => {
    const h = harness({ failWith: { response: { status: 500 } } });
    h.poller.start();
    await h.settle();
    h.advance(UNREAD_POLL_MS);
    h.tick();
    await h.settle();
    assert.equal(h.loads, 2);
    assert.equal(h.timers.length, 1);
  });

  test("halt (a 401 from the list) stops the count poll too", async () => {
    const h = harness();
    h.poller.start();
    await h.settle();
    h.poller.halt();
    h.advance(UNREAD_POLL_MS);
    h.tick();
    h.poller.handleFocus();
    await h.settle();
    assert.equal(h.loads, 1);
    assert.equal(h.timers.length, 0);
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

describe("isUnauthorizedError", () => {
  test("only a 401 response counts", () => {
    assert.equal(isUnauthorizedError({ response: { status: 401 } }), true);
    assert.equal(isUnauthorizedError({ response: { status: 403 } }), false);
    assert.equal(isUnauthorizedError({ response: { status: 500 } }), false);
    assert.equal(isUnauthorizedError({ code: "ECONNABORTED" }), false);
    assert.equal(isUnauthorizedError(new Error("offline")), false);
    assert.equal(isUnauthorizedError(null), false);
    assert.equal(isUnauthorizedError("401"), false);
  });
});
