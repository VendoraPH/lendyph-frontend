import { test } from "node:test";
import assert from "node:assert/strict";
import { openPrintable } from "./print-open";
import type { PrintableDocument } from "./types";

/**
 * `openPrintable` is four lines of browser plumbing, and both of the things it
 * does beyond `window.open` are invisible until they go wrong: the object URL
 * it revokes (the code this replaced leaked one per document, all day) and the
 * blocked pop-up it reports (which otherwise looks to a teller like a dead
 * button). Both are stubbed and asserted here rather than left to a manual pass.
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
  opened: string[];
  /** Fire the new tab's load event, as a browser would once it has painted. */
  fireLoad: () => void;
  /** Run the backstop timer, as a browser would after the delay. */
  fireTimer: () => void;
  restore: () => void;
}

function stubBrowser({ popupBlocked = false } = {}): Harness {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previousWindow = globals.window;
  const objectUrl = URL as unknown as Record<string, unknown>;
  const previousCreate = objectUrl.createObjectURL;
  const previousRevoke = objectUrl.revokeObjectURL;

  const created: string[] = [];
  const revoked: string[] = [];
  const opened: string[] = [];
  const loadListeners: Array<() => void> = [];
  const timers: Array<() => void> = [];

  objectUrl.createObjectURL = () => {
    const url = `blob:https://app.test/${created.length}`;
    created.push(url);
    return url;
  };
  objectUrl.revokeObjectURL = (url: string) => {
    revoked.push(url);
  };

  globals.window = {
    open: (url: string) => {
      opened.push(url);
      if (popupBlocked) return null;
      return {
        addEventListener: (event: string, handler: () => void) => {
          if (event === "load") loadListeners.push(handler);
        },
        focus: () => {},
      };
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
    fireLoad: () => loadListeners.forEach((handler) => handler()),
    fireTimer: () => timers.forEach((handler) => handler()),
    restore: () => {
      if (previousWindow === undefined) delete globals.window;
      else globals.window = previousWindow;
      objectUrl.createObjectURL = previousCreate;
      objectUrl.revokeObjectURL = previousRevoke;
    },
  };
}

test("the rendered document is opened in a new tab", () => {
  const harness = stubBrowser();
  try {
    assert.equal(openPrintable(doc()), "opened");
    assert.equal(harness.created.length, 1);
    assert.deepEqual(harness.opened, harness.created);
    // Nothing is revoked while the tab is still loading — that would leave the
    // user staring at a failed navigation.
    assert.deepEqual(harness.revoked, []);
  } finally {
    harness.restore();
  }
});

test("the object URL is revoked once the tab has the document", () => {
  const harness = stubBrowser();
  try {
    openPrintable(doc());
    harness.fireLoad();

    assert.deepEqual(harness.revoked, harness.created);
  } finally {
    harness.restore();
  }
});

test("a browser that never fires load still frees the blob", () => {
  const harness = stubBrowser();
  try {
    openPrintable(doc());
    harness.fireTimer();

    assert.deepEqual(harness.revoked, harness.created);
  } finally {
    harness.restore();
  }
});

test("a blocked pop-up is reported, and leaks nothing", () => {
  const harness = stubBrowser({ popupBlocked: true });
  try {
    assert.equal(openPrintable(doc()), "popup_blocked");
    // The URL nothing will ever display is released immediately.
    assert.deepEqual(harness.revoked, harness.created);
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
