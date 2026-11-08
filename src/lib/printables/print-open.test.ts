import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "@/lib/api-client";
import { openPrintable } from "./print-open";
import type { PrintableDocument } from "./types";

/**
 * `openPrintable` is a dozen lines of browser plumbing, and everything it does
 * beyond `window.open` is invisible until it goes wrong: the blocked pop-up
 * (which looks to a teller like a dead button), and — the reason this file was
 * rewritten — WHERE the markup comes from.
 *
 * It used to `window.open` a `blob:` URL, which parks that URL in the new tab's
 * address bar. A teller nudging Enter there searched Google for
 * `blob:http://localhost:3000/2079f4ad-…` instead of reading the disclosure
 * statement. The document is now written into a blank tab, and the assertions
 * below pin that down: the tab is opened with no URL, and on the main path no
 * object URL is minted at all.
 */

function doc(): PrintableDocument {
  return {
    id: "official_receipt",
    org: { name: "Binhs Multi-Purpose Cooperative", logoUrl: null },
    title: "Official Receipt",
    generatedAt: "Aug 26, 2026, 1:42 AM",
    blocks: [{ kind: "note", text: "Received with thanks." }],
  };
}

interface Harness {
  created: string[];
  revoked: string[];
  /** The URLs `window.open` was called with — `""` for a blank tab. */
  opened: string[];
  /** Everything written into the new tab's document. */
  writes: string[];
  /** Whether the new tab's document was closed after writing. */
  closed: () => boolean;
  /** Where the new tab was navigated, if it was navigated at all. */
  navigatedTo: () => string | null;
  /** Run the backstop timer, as a browser would after the delay. */
  fireTimer: () => void;
  restore: () => void;
}

function stubBrowser({
  popupBlocked = false,
  // The one browser shape that forces the fallback: the opener cannot reach
  // into the tab it just opened.
  documentUnreachable = false,
} = {}): Harness {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previousWindow = globals.window;
  const objectUrl = URL as unknown as Record<string, unknown>;
  const previousCreate = objectUrl.createObjectURL;
  const previousRevoke = objectUrl.revokeObjectURL;

  const created: string[] = [];
  const revoked: string[] = [];
  const opened: string[] = [];
  const writes: string[] = [];
  const timers: Array<() => void> = [];
  let closed = false;
  let navigatedTo: string | null = null;

  objectUrl.createObjectURL = () => {
    const url = `blob:https://app.test/${created.length}`;
    created.push(url);
    return url;
  };
  objectUrl.revokeObjectURL = (url: string) => {
    revoked.push(url);
  };

  const newTab = {
    get document() {
      if (documentUnreachable) throw new Error("cross-origin");
      return {
        open: () => {},
        write: (html: string) => writes.push(html),
        close: () => {
          closed = true;
        },
      };
    },
    location: {
      set href(url: string) {
        navigatedTo = url;
      },
    },
    focus: () => {},
  };

  globals.window = {
    open: (url: string) => {
      opened.push(url);
      return popupBlocked ? null : newTab;
    },
    setTimeout: (handler: () => void) => {
      timers.push(handler);
      return 1;
    },
  };

  return {
    created,
    revoked,
    opened,
    writes,
    closed: () => closed,
    navigatedTo: () => navigatedTo,
    fireTimer: () => timers.forEach((handler) => handler()),
    restore: () => {
      if (previousWindow === undefined) delete globals.window;
      else globals.window = previousWindow;
      objectUrl.createObjectURL = previousCreate;
      objectUrl.revokeObjectURL = previousRevoke;
    },
  };
}

test("the tab is opened blank, so no URL reaches the address bar", () => {
  const harness = stubBrowser();
  try {
    assert.equal(openPrintable(doc()), "opened");
    // The whole point. Anything else here — a `blob:` URL above all — is a
    // string the user can accidentally submit to a search engine.
    assert.deepEqual(harness.opened, [""]);
  } finally {
    harness.restore();
  }
});

test("the rendered document is written into the new tab", () => {
  const harness = stubBrowser();
  try {
    openPrintable(doc());

    assert.equal(harness.writes.length, 1);
    assert.match(harness.writes[0], /<!DOCTYPE html>/);
    assert.match(harness.writes[0], /Official Receipt/);
    assert.match(harness.writes[0], /Received with thanks\./);
  } finally {
    harness.restore();
  }
});

test("the document is closed, so the tab stops loading", () => {
  const harness = stubBrowser();
  try {
    openPrintable(doc());
    // Left open, the tab spins forever and `window.print()` fires against a
    // document the browser still considers unfinished.
    assert.equal(harness.closed(), true);
  } finally {
    harness.restore();
  }
});

test("nothing is minted on the main path, so nothing can leak or be revoked early", () => {
  const harness = stubBrowser();
  try {
    openPrintable(doc());

    assert.deepEqual(harness.created, []);
    assert.deepEqual(harness.revoked, []);
    assert.equal(harness.navigatedTo(), null);
  } finally {
    harness.restore();
  }
});

test("a blocked pop-up is reported, and leaks nothing", () => {
  const harness = stubBrowser({ popupBlocked: true });
  try {
    assert.equal(openPrintable(doc()), "popup_blocked");
    assert.deepEqual(harness.created, []);
    assert.deepEqual(harness.writes, []);
  } finally {
    harness.restore();
  }
});

test("calling it where there is no window is a signal, not a crash", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previousWindow = globals.window;
  delete globals.window;
  try {
    assert.equal(openPrintable(doc()), "unavailable");
  } finally {
    if (previousWindow !== undefined) globals.window = previousWindow;
  }
});

// ── the fallback ───────────────────────────────────────────────────────────

test("a tab the opener cannot write into is handed a URL instead", () => {
  const harness = stubBrowser({ documentUnreachable: true });
  try {
    assert.equal(openPrintable(doc()), "opened");
    assert.equal(harness.created.length, 1);
    assert.equal(harness.navigatedTo(), harness.created[0]);
  } finally {
    harness.restore();
  }
});

test("the fallback does not revoke the URL the tab is still loading", () => {
  const harness = stubBrowser({ documentUnreachable: true });
  try {
    openPrintable(doc());
    // The listener this replaces was attached to the opener's view of the new
    // window, whose initial empty document fires `load` before the blob
    // navigation commits — it revoked the URL mid-flight.
    assert.deepEqual(harness.revoked, []);
  } finally {
    harness.restore();
  }
});

test("the fallback frees its blob on the backstop timer", () => {
  const harness = stubBrowser({ documentUnreachable: true });
  try {
    openPrintable(doc());
    harness.fireTimer();

    assert.deepEqual(harness.revoked, harness.created);
  } finally {
    harness.restore();
  }
});

// ---------------------------------------------------------------------------
// The print log (disclosure statement and promissory note)
//
// The browser's `beforeprint` is the one signal that covers the tab's Print
// button, Ctrl+P and Save as PDF (which is the same dialog). Opening the tab is
// only a preview, and "Printed" in the audit trail should not claim otherwise.
// ---------------------------------------------------------------------------

function stubPrintTab({ listenerRefused = false, documentUnreachable = false } = {}) {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previousWindow = globals.window;
  const objectUrl = URL as unknown as Record<string, unknown>;
  const previousCreate = objectUrl.createObjectURL;
  const listeners: Array<{ event: string; handler: () => void }> = [];
  const order: string[] = [];

  objectUrl.createObjectURL = () => "blob:https://app.test/0";
  const newTab = {
    get document() {
      if (documentUnreachable) throw new Error("cross-origin");
      return {
        open: () => order.push("open"),
        write: () => order.push("write"),
        close: () => order.push("close"),
      };
    },
    location: { set href(_url: string) {} },
    focus: () => {},
    addEventListener: (event: string, handler: () => void) => {
      if (listenerRefused) throw new Error("refused");
      order.push("listen");
      listeners.push({ event, handler });
    },
  };
  globals.window = { open: () => newTab, setTimeout: () => 1 };

  const posts: Array<{ url: string; body: unknown }> = [];
  const originalPost = api.rawPost;
  api.rawPost = (async (url: string, body?: unknown) => {
    posts.push({ url, body });
    return { logged: true };
  }) as typeof api.rawPost;

  return {
    listeners,
    order,
    posts,
    print: () =>
      listeners.filter((l) => l.event === "beforeprint").forEach((l) => l.handler()),
    restore: () => {
      if (previousWindow === undefined) delete globals.window;
      else globals.window = previousWindow;
      objectUrl.createObjectURL = previousCreate;
      api.rawPost = originalPost;
    },
  };
}

function disclosure(subjectId?: number): PrintableDocument {
  return { ...doc(), id: "disclosure_statement", subjectId };
}

test("opening a disclosure logs nothing; printing it logs once per print", () => {
  const tab = stubPrintTab();
  try {
    assert.equal(openPrintable(disclosure(42)), "opened");
    assert.deepEqual(tab.posts, []);

    tab.print();
    assert.deepEqual(tab.posts, [{ url: "/loans/42/print-log", body: { document: "disclosure" } }]);

    tab.print();
    assert.equal(tab.posts.length, 2);
  } finally {
    tab.restore();
  }
});

test("the print listener goes on after the document is written", () => {
  // `document.open()` erases a window's listeners, so one attached earlier
  // would never fire.
  const tab = stubPrintTab();
  try {
    openPrintable(disclosure(42));
    assert.deepEqual(tab.order, ["open", "write", "close", "listen"]);
  } finally {
    tab.restore();
  }
});

test("a receipt or a blank form gets no print listener", () => {
  const tab = stubPrintTab();
  try {
    openPrintable(doc());
    openPrintable(disclosure());
    assert.deepEqual(tab.listeners, []);
  } finally {
    tab.restore();
  }
});

test("a tab that refuses the listener still opens", () => {
  const tab = stubPrintTab({ listenerRefused: true });
  try {
    assert.equal(openPrintable(disclosure(42)), "opened");
  } finally {
    tab.restore();
  }
});

test("the fallback tab can't be listened to, so opening it is what gets logged", () => {
  const tab = stubPrintTab({ documentUnreachable: true });
  try {
    assert.equal(openPrintable(disclosure(42)), "opened");
    assert.deepEqual(tab.posts, [{ url: "/loans/42/print-log", body: { document: "disclosure" } }]);
  } finally {
    tab.restore();
  }
});
