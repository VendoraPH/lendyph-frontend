import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "@/lib/api-client";
import { logPrint, printLogRequest } from "./print-log";
import type { PrintableDocument, PrintableId } from "./types";

/**
 * Printing a disclosure statement or a promissory note writes an audit row
 * through `POST /loans/{loan}/print-log`. The call is a record of the print,
 * never a condition of it: a refused or failed call stays silent.
 */

function doc(id: PrintableId, subjectId?: number): PrintableDocument {
  return {
    id,
    subjectId,
    org: { name: null, logoUrl: null },
    title: "Document",
    generatedAt: "Nov 5, 2026, 9:00 AM",
    blocks: [],
  };
}

function stubPost(result: () => Promise<unknown>) {
  const sent: Array<{ url: string; body: unknown }> = [];
  const original = api.rawPost;
  api.rawPost = (async (url: string, body?: unknown) => {
    sent.push({ url, body });
    return result();
  }) as typeof api.rawPost;
  return { sent, restore: () => void (api.rawPost = original) };
}

test("the disclosure statement and promissory note log under their API names", () => {
  assert.deepEqual(printLogRequest(doc("disclosure_statement", 42)), {
    url: "/loans/42/print-log",
    body: { document: "disclosure" },
  });
  assert.deepEqual(printLogRequest(doc("promissory_note", 42)), {
    url: "/loans/42/print-log",
    body: { document: "promissory_note" },
  });
});

test("every other document logs nothing", () => {
  const others: PrintableId[] = [
    "official_receipt",
    "release_voucher",
    "demand_letter",
    "amortization_schedule",
    "share_capital_certificate",
    "member_ledger_card",
  ];
  for (const id of others) assert.equal(printLogRequest(doc(id, 42)), null);
});

test("a document with no loan behind it logs nothing", () => {
  assert.equal(printLogRequest(doc("disclosure_statement")), null);

  const post = stubPost(async () => ({ logged: true }));
  try {
    logPrint(doc("promissory_note"));
    assert.deepEqual(post.sent, []);
  } finally {
    post.restore();
  }
});

test("logging a print posts once", async () => {
  const post = stubPost(async () => ({ logged: true }));
  try {
    logPrint(doc("disclosure_statement", 7));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(post.sent, [{ url: "/loans/7/print-log", body: { document: "disclosure" } }]);
  } finally {
    post.restore();
  }
});

test("a refused or failed call is swallowed", async () => {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);
  process.on("unhandledRejection", onRejection);
  const post = stubPost(async () => {
    throw new Error("422");
  });
  try {
    assert.doesNotThrow(() => logPrint(doc("disclosure_statement", 7)));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(post.sent.length, 1);
    assert.deepEqual(rejections, []);
  } finally {
    post.restore();
    process.off("unhandledRejection", onRejection);
  }
});
