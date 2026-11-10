/**
 * The attachments panel on a journal or an expense (C6, backend #250).
 *
 * The rules are tested through the helpers the panel renders from, and the
 * wire through a stub server, so the assertions are about the request the
 * browser actually sent: the multipart body, and the reason (or no body) on a
 * removal.
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AccountingAttachment } from "@/types/accounting";

type Panel = typeof import("./attachments-panel");

interface Recorded {
  method: string;
  path: string;
  contentType: string;
  body: string;
}

let server: Server;
let requests: Recorded[] = [];
let panel: Panel;

before(async () => {
  server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      requests.push({
        method: req.method ?? "GET",
        path,
        contentType: String(req.headers["content-type"] ?? ""),
        body: Buffer.concat(chunks).toString("utf8"),
      });
      res.setHeader("Content-Type", "application/json");
      if (req.method === "DELETE") return res.end(JSON.stringify({ message: "Attachment removed." }));
      if (req.method === "POST") {
        res.statusCode = 201;
        return res.end(JSON.stringify({ data: attachment() }));
      }
      return res.end(JSON.stringify({ data: [attachment()] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Set BEFORE importing: axios-client resolves its baseURL at module init.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  panel = await import("./attachments-panel");
});

after(() => {
  server?.close();
});

beforeEach(() => {
  requests = [];
});

function onlyRequest(): Recorded {
  assert.equal(requests.length, 1, "one call, one request");
  return requests[0];
}

function attachment(overrides: Partial<AccountingAttachment> = {}): AccountingAttachment {
  return {
    id: 7,
    label: "Official receipt",
    original_filename: "receipt-0042.pdf",
    mime_type: "application/pdf",
    file_size: 1_258_291,
    url: "https://api.example.test/api/files/documents/7?expires=1&signature=abc",
    uploaded_by: { id: 3, name: "Ana Cruz" },
    created_at: "2026-11-09T02:15:00.000000Z",
    can_remove: true,
    ...overrides,
  };
}

const pdf = (bytes = 8) => new File(["x".repeat(bytes)], "receipt.pdf", { type: "application/pdf" });

describe("the list", () => {
  test("sizes read in words", () => {
    assert.equal(panel.formatFileSize(1_258_291), "1.2 MB");
    assert.equal(panel.formatFileSize(10 * 1024 * 1024), "10.0 MB");
    assert.equal(panel.formatFileSize(2048), "2.0 KB");
    assert.equal(panel.formatFileSize(512), "512 bytes");
    assert.equal(panel.formatFileSize(1), "1 byte");
    assert.equal(panel.formatFileSize(Number.NaN), "0 bytes");
  });

  test("a row shows the file, label, size, uploader and time, and opens the signed link in a new tab", () => {
    const html = renderToStaticMarkup(
      createElement(panel.AttachmentRows, {
        attachments: [attachment()],
        onOpen: () => undefined,
        onRemove: () => undefined,
        removeBlockedReason: null,
      }),
    );
    assert.match(html, /receipt-0042\.pdf/);
    assert.match(html, /Official receipt/);
    assert.match(html, /1\.2 MB/);
    assert.match(html, /Ana Cruz/);
    assert.match(html, /Nov 9, 2026/);
    assert.match(html, /href="https:\/\/api\.example\.test\/api\/files\/documents\/7\?expires=1&amp;signature=abc"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener"/);
    // Never a raw key or the mime type on screen.
    assert.doesNotMatch(html, /application\/pdf/);
    assert.match(html, />Remove</);
  });

  test("a row with no uploader and no label still reads in words", () => {
    const html = renderToStaticMarkup(
      createElement(panel.AttachmentRows, {
        attachments: [attachment({ uploaded_by: null, label: null })],
        onOpen: () => undefined,
        onRemove: () => undefined,
        removeBlockedReason: null,
      }),
    );
    assert.match(html, /Uploaded Nov 9, 2026/);
    assert.doesNotMatch(html, /null|undefined/);
  });

  test("without can_remove the action is disabled and says why", () => {
    const reason = panel.removeBlockedReason({ kind: "journal", id: 9, status: "posted" });
    const html = renderToStaticMarkup(
      createElement(panel.AttachmentRows, {
        attachments: [attachment({ can_remove: false })],
        onOpen: () => undefined,
        onRemove: () => undefined,
        removeBlockedReason: reason,
      }),
    );
    assert.match(html, /disabled=""/);
    assert.ok(html.includes(reason));
  });

  test("the link counts as stale after a few minutes, well inside its 30", () => {
    const fetched = Date.parse("2026-11-09T10:00:00Z");
    assert.equal(panel.isLinkStale(fetched, fetched + 4 * 60_000), false);
    assert.equal(panel.isLinkStale(fetched, fetched + 5 * 60_000 + 1), true);
    assert.equal(panel.isLinkStale(null, fetched), true);
  });
});

describe("upload", () => {
  test("hidden without the owner's create permission", () => {
    assert.deepEqual(panel.uploadState({ kind: "journal", id: 1 }, false, 0), { shown: false });
    assert.deepEqual(panel.uploadState({ kind: "expense", id: 1 }, false, 0), { shown: false });
  });

  test("open below the limit, with the count in words", () => {
    assert.deepEqual(panel.uploadState({ kind: "journal", id: 1 }, true, 19), {
      shown: true,
      disabledReason: null,
      countText: "19 of 20 attachments",
    });
    assert.deepEqual(panel.uploadState({ kind: "journal", id: 1 }, true, 1), {
      shown: true,
      disabledReason: null,
      countText: "1 of 20 attachments",
    });
  });

  test("20 of 20 disables it with the server's limit in words", () => {
    assert.deepEqual(panel.uploadState({ kind: "journal", id: 1 }, true, 20), {
      shown: true,
      disabledReason: "A journal can hold at most 20 attachments.",
      countText: "20 of 20 attachments",
    });
    assert.deepEqual(panel.uploadState({ kind: "expense", id: 1 }, true, 20), {
      shown: true,
      disabledReason: "An expense can hold at most 20 attachments.",
      countText: "20 of 20 attachments",
    });
  });

  test("the permission is journals:create or expenses:create", () => {
    assert.equal(panel.uploadPermission("journal"), "journals:create");
    assert.equal(panel.uploadPermission("expense"), "expenses:create");
  });

  test("the pre-check blocks only the obvious", () => {
    const big = new File(["x"], "scan.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 10 * 1024 * 1024 + 1 });
    const exact = new File(["x"], "scan.PDF", { type: "" });
    Object.defineProperty(exact, "size", { value: 10 * 1024 * 1024 });

    assert.equal(panel.precheckFile(exact), null);
    // .jpe and .jfif are JPEG names the server takes too.
    for (const name of ["a.jpg", "a.jpeg", "a.jpe", "a.JFIF", "a.png", "a.pdf", "a.doc", "a.docx"]) {
      assert.equal(panel.precheckFile(new File(["x"], name)), null, name);
    }
    assert.equal(panel.precheckFile(big), "This file is larger than 10 MB.");
    assert.equal(
      panel.precheckFile(new File(["x"], "setup.exe")),
      "Use a JPG, PNG, PDF, DOC or DOCX file.",
    );
    assert.equal(
      panel.precheckFile(new File(["x"], "noextension")),
      "Use a JPG, PNG, PDF, DOC or DOCX file.",
    );
  });

  test("the journal upload is multipart with the file and the trimmed label", async () => {
    await panel.attachmentCallsFor({ kind: "journal", id: 9 }).upload(pdf(), "  Official receipt  ");
    const req = onlyRequest();
    assert.equal(req.method, "POST");
    assert.equal(req.path, "/accounting/journals/9/attachments");
    assert.match(req.contentType, /^multipart\/form-data; boundary=/);
    assert.match(req.body, /name="file"; filename="receipt\.pdf"/);
    assert.match(req.body, /name="label"\r\n\r\nOfficial receipt\r\n/);
  });

  test("a blank label sends no label part, on an expense too", async () => {
    await panel.attachmentCallsFor({ kind: "expense", id: 4 }).upload(pdf(), "   ");
    const req = onlyRequest();
    assert.equal(req.path, "/accounting/expenses/4/attachments");
    assert.match(req.body, /name="file"; filename="receipt\.pdf"/);
    assert.doesNotMatch(req.body, /name="label"/);
  });

  test("the list reads the owner's attachments", async () => {
    const rows = await panel.attachmentCallsFor({ kind: "expense", id: 4 }).list();
    assert.equal(onlyRequest().path, "/accounting/expenses/4/attachments");
    assert.equal(rows[0].original_filename, "receipt-0042.pdf");
  });
});

describe("remove", () => {
  test("a draft journal is a plain confirm, with no reason", () => {
    assert.equal(panel.removalNeedsReason({ kind: "journal", id: 9, status: "draft" }), false);
  });

  test("a posted or reversed journal, an expense, or an unknown status needs a reason", () => {
    assert.equal(panel.removalNeedsReason({ kind: "journal", id: 9, status: "posted" }), true);
    assert.equal(panel.removalNeedsReason({ kind: "journal", id: 9, status: "reversed" }), true);
    assert.equal(panel.removalNeedsReason({ kind: "journal", id: 9 }), true);
    assert.equal(panel.removalNeedsReason({ kind: "expense", id: 4, status: "paid" }), true);
    assert.equal(panel.removalNeedsReason({ kind: "expense", id: 4 }), true);
  });

  test("the reason is required where it's needed, and at most 500 characters", () => {
    assert.equal(panel.reasonError("", true), "Say why this attachment is being removed.");
    assert.equal(panel.reasonError("   ", true), "Say why this attachment is being removed.");
    assert.equal(panel.reasonError("Wrong file", true), null);
    assert.equal(panel.reasonError("x".repeat(500), true), null);
    assert.equal(panel.reasonError("x".repeat(501), true), "Keep the reason to 500 characters.");
    assert.equal(panel.reasonError("", false), null);
  });

  test("the blocked reason names who can remove it", () => {
    assert.equal(
      panel.removeBlockedReason({ kind: "journal", id: 9, status: "draft" }),
      "Only users who can create journal entries can remove an attachment from a draft.",
    );
    assert.equal(
      panel.removeBlockedReason({ kind: "journal", id: 9, status: "posted" }),
      "Only users who manage accounting settings can remove an attachment from a posted or reversed journal.",
    );
    assert.equal(
      panel.removeBlockedReason({ kind: "expense", id: 4 }),
      "Only users who manage accounting settings can remove an attachment from an expense.",
    );
  });

  test("a draft removal sends no body; a posted one sends the trimmed reason", async () => {
    const draft = { kind: "journal", id: 9, status: "draft" } as const;
    await panel.attachmentCallsFor(draft).remove(7, panel.removalReason(draft, "ignored"));
    let req = onlyRequest();
    assert.equal(req.method, "DELETE");
    assert.equal(req.path, "/accounting/journals/9/attachments/7");
    assert.equal(req.body, "");

    requests = [];
    const posted = { kind: "journal", id: 9, status: "posted" } as const;
    await panel.attachmentCallsFor(posted).remove(7, panel.removalReason(posted, "  Wrong file  "));
    req = onlyRequest();
    assert.deepEqual(JSON.parse(req.body), { reason: "Wrong file" });

    requests = [];
    const expense = { kind: "expense", id: 4 } as const;
    await panel.attachmentCallsFor(expense).remove(7, panel.removalReason(expense, "Duplicate"));
    req = onlyRequest();
    assert.equal(req.path, "/accounting/expenses/4/attachments/7");
    assert.deepEqual(JSON.parse(req.body), { reason: "Duplicate" });
  });

  test("a removal that lost the race shows the server's words and reloads", () => {
    const conflict = {
      response: { status: 409, data: { message: "This journal was posted. Reload and try again." } },
    };
    assert.deepEqual(panel.removalFailure(conflict), {
      message: "This journal was posted. Reload and try again.",
      reload: true,
    });
    const gone = { response: { status: 404, data: { message: "Not found." } } };
    assert.equal(panel.removalFailure(gone).reload, true);
    // A caller who can remove nothing on the route gets 403 before any lookup:
    // its can_remove was stale, so the list is read again to turn Remove off.
    const refused = { response: { status: 403, data: { message: "You can't remove this attachment." } } };
    assert.deepEqual(panel.removalFailure(refused), {
      message: "You can't remove this attachment.",
      reload: true,
    });
    const invalid = {
      response: { status: 422, data: { message: "x", errors: { reason: ["The reason field is required."] } } },
    };
    assert.deepEqual(panel.removalFailure(invalid), {
      message: "The reason field is required.",
      reload: false,
    });
  });
});

describe("wiring", () => {
  const source = (path: string) =>
    readFileSync(join(process.cwd(), "src/app/(app)/accounting", path), "utf8");

  test("the journal page shows the panel under the lines, for every status", () => {
    const page = source("journals/[id]/page.tsx");
    assert.match(
      page,
      /<AttachmentsPanel owner=\{\{ kind: "journal", id: entry\.id, status: entry\.status \}\} \/>/,
    );
    // After the lines (details or the edit form), outside any status check.
    assert.ok(page.indexOf("<AttachmentsPanel") > page.indexOf("<JournalDetails"));
    assert.doesNotMatch(page, /status === "draft"[^\n]*<AttachmentsPanel/);
  });

  test("each expense row opens its attachments in a dialog, for anyone who can see the list", () => {
    const page = source("expenses/page.tsx");
    assert.match(page, /onAttachments=\{setAttaching\}/);
    assert.match(page, /<AttachmentsDialog\s+expense=\{attaching\}/);

    const table = source("expenses/_components/expense-table.tsx");
    assert.match(table, /onClick=\{\(\) => onAttachments\(expense\)\}/);
    assert.match(table, />\s*Attachments\s*</);
    // The Actions column no longer depends on Pay or Edit.
    assert.doesNotMatch(table, /hasActions/);

    const dialog = source("_components/attachments-dialog.tsx");
    assert.match(dialog, /<AttachmentsPanel owner=\{\{ kind: "expense", id: expense\.id, status: expense\.status \}\} \/>/);
  });
});
