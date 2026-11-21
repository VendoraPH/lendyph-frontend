import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { amlaColumnAlign, amlaCountBlocks, amlaDefaultRange, amlaReportRangeError } from "./report-view";

const NONE = { alerts: null, ctr_candidates: null, cases: null, filings: null, cdd: null };

describe("the AMLA dashboard counts", () => {
  test("a block the server sends null (no key) doesn't show", () => {
    assert.deepEqual(amlaCountBlocks(NONE), []);
    const blocks = amlaCountBlocks({ ...NONE, filings: { upcoming: 2, due_today: 0, overdue: 1 } });
    assert.deepEqual(blocks.map((b) => b.key), ["filings"]);
  });

  test("alerts: most urgent first, the server's total as the headline, a critical alert is urgent", () => {
    const [alerts] = amlaCountBlocks({ ...NONE, alerts: { low: 4, medium: 0, high: 2, critical: 1, total: 7 } });
    assert.equal(alerts.total, 7);
    assert.deepEqual(
      alerts.lines.map((l) => [l.label, l.value, l.urgent]),
      [
        ["Critical", 1, true],
        ["High", 2, false],
        ["Medium", 0, false],
        ["Low", 4, false],
      ],
    );
  });

  test("filings: overdue and due today are urgent only when above zero", () => {
    const [filings] = amlaCountBlocks({ ...NONE, filings: { upcoming: 3, due_today: 0, overdue: 2 } });
    assert.equal(filings.total, null);
    assert.deepEqual(
      filings.lines.map((l) => [l.label, l.value, l.urgent]),
      [
        ["Overdue", 2, true],
        ["Due today", 0, false],
        ["Due soon", 3, false],
      ],
    );
  });

  test("statuses read in words, and a status the server adds later still shows", () => {
    const [ctr] = amlaCountBlocks({ ...NONE, ctr_candidates: { detected: 5, report_prepared: 1, set_aside_pending: 0, not_reportable: 2, merged: 1 } });
    assert.deepEqual(
      ctr.lines.map((l) => [l.label, l.value]),
      [
        ["Detected", 5],
        ["CTR prepared", 1],
        ["Not reportable, waiting for a second approver", 0],
        ["Not reportable, with a documented reason", 2],
        ["merged", 1],
      ],
    );
  });

  test("blocks keep one order and link to their screens", () => {
    const counts = { alerts: { total: 0 }, ctr_candidates: {}, cases: {}, filings: {}, cdd: {} };
    assert.deepEqual(
      amlaCountBlocks(counts).map((b) => [b.key, b.href]),
      [
        ["alerts", "/amla/alerts"],
        ["filings", "/amla/submissions"],
        ["ctr_candidates", "/amla/ctr-candidates"],
        ["cases", "/amla/cases"],
        ["cdd", "/amla/customers"],
      ],
    );
  });

  test("nothing is summed on the page: the total is the server's", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/amla/report-view.ts"), "utf8");
    assert.doesNotMatch(source, /\.reduce\(/);
  });
});

describe("the AMLA report screen", () => {
  test("numbers and money align right, text and dates left", () => {
    assert.equal(amlaColumnAlign({ key: "a", label: "A", format: "money" }), "right");
    assert.equal(amlaColumnAlign({ key: "a", label: "A", format: "number" }), "right");
    assert.equal(amlaColumnAlign({ key: "a", label: "A", format: "date" }), "left");
    assert.equal(amlaColumnAlign({ key: "a", label: "A", format: "text" }), "left");
  });

  test("the default range is this month to today, as the server's", () => {
    assert.deepEqual(amlaDefaultRange("2026-11-21"), { from: "2026-11-01", to: "2026-11-21" });
  });

  test("a range needs both dates, in order", () => {
    assert.equal(amlaReportRangeError("2026-11-01", "2026-11-21"), null);
    assert.equal(amlaReportRangeError("2026-11-21", "2026-11-21"), null);
    assert.equal(amlaReportRangeError("", "2026-11-21"), "Pick both dates.");
    assert.equal(amlaReportRangeError("2026-11-21", "2026-11-01"), "The end date can't be before the start date.");
  });
});
