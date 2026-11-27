import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

/**
 * Finding 20: on a computer set to US Pacific time, every date on the statement
 * read a day early. The zone has to be set before the formatters are built, so
 * this file has its own process (each test file does) and loads them after it.
 */
process.env.TZ = "America/Los_Angeles";

const format = () => import("@/lib/report-format");

test("the fixture really runs on a computer west of Manila", () => {
  assert.equal(new Date("2026-12-05").getDate(), 4);
});

test("a date-only value reads its own day", async () => {
  const { formatDateRange, formatValue } = await format();
  assert.equal(formatValue("2026-12-05", "date"), "Dec 5, 2026");
  assert.equal(formatDateRange("2026-12-01", "2026-12-05"), "Dec 1, 2026 – Dec 5, 2026");
});

test("a timestamp reads its Philippine day and time", async () => {
  const { formatValue } = await format();
  assert.equal(formatValue("2026-12-04T16:30:00.000000Z", "date"), "Dec 5, 2026");
  assert.match(formatValue("2026-12-04T16:30:00Z", "datetime"), /^Dec 5, 2026.* 12:30.AM$/i);
});

test("a server time with no zone is already Philippine time", async () => {
  const { formatValue } = await format();
  assert.match(formatValue("2026-12-05 14:05:00", "datetime"), /^Dec 5, 2026.* 2:05.PM$/i);
  assert.equal(formatValue("2026-12-05 00:10:00", "date"), "Dec 5, 2026");
});

test("a printable reads a server time the same way as a report", async () => {
  const { dateField, dateOrBlank, dateOrDash, dateTimeField } = await import(
    "@/lib/printables/templates/shared"
  );
  assert.match(dateTimeField("Voided on", "2026-08-27 10:02:00").value ?? "", /^Aug 27, 2026.* 10:02.AM$/i);
  assert.equal(dateField("Date", "2026-08-26").value, "Aug 26, 2026");
  assert.equal(dateOrBlank("2026-08-26 23:30:00"), "Aug 26, 2026");
  assert.equal(dateOrDash("2026-08-26"), "Aug 26, 2026");
});

test("Generated reads in Philippine time", async () => {
  const { formatGeneratedAt } = await format();
  assert.match(formatGeneratedAt(new Date("2026-12-04T16:30:00Z")), /^Dec 5, 2026.* 12:30.AM$/i);
});

test("a reference is stamped in Philippine time", async () => {
  const { buildReference } = await import("./report-chrome");
  assert.equal(buildReference("aging_report", new Date("2026-12-04T16:30:00Z")), "AGE-20261205-0030");
});

test("excel: date cells hold the Philippine day and time", async () => {
  const { buildReportWorkbook } = await import("./report-excel");
  const workbook = buildReportWorkbook({
    reportId: "aging_report",
    meta: { title: "Dates", generatedAt: "", org: "" },
    sections: [
      {
        kind: "table",
        columns: [
          { key: "day", header: "Day", format: "date" },
          { key: "stamp", header: "Stamp", format: "datetime" },
        ],
        rows: [{ day: "2026-12-05", stamp: "2026-12-04T16:30:00Z" }],
      },
    ],
  });
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
  let found: ExcelJS.Row | undefined;
  reopened.worksheets[0].eachRow((row) => {
    if (row.getCell(1).value instanceof Date) found = row;
  });
  assert.ok(found, "no date row");
  // ExcelJS holds a cell's clock time in the Date's UTC parts.
  assert.equal((found.getCell(1).value as Date).getTime(), Date.UTC(2026, 11, 5));
  assert.equal((found.getCell(2).value as Date).getTime(), Date.UTC(2026, 11, 5, 0, 30));
});
