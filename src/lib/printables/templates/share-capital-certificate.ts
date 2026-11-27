/**
 * Share Capital Certificate & Member Statement.
 *
 * Source: `reportService.shareCapitalStatement(borrowerId, params)` — the new
 * `GET /api/reports/share-capital-statement/{borrower}`, which returns an
 * opening balance, entries ordered oldest-first with a running balance, period
 * totals and a closing balance. That endpoint is the only one that can support
 * a certificate, and when it answers this document certifies.
 *
 * `catalog.ts` falls back to `shareCapitalService.ledgerList({ borrower_id })`
 * when it does not — realistic on a mixed-version fleet, where the frontend can
 * be ahead of a deployment's backend. That list is a different animal and this
 * template treats it as one:
 *
 *   - it is ordered **newest-first** (`ShareCapitalLedgerController::index()`
 *     does `->orderByDesc('date')->orderByDesc('id')`), so entries are sorted
 *     back into date order, the order a ledger reads in;
 *   - it carries no running balance, no totals and no closing balance
 *     (`ShareCapitalLedgerResource` sends `debit` and `credit` and nothing
 *     else). With no balance from the server there is nothing to certify, so
 *     it prints as a ledger extract, never a certificate;
 *   - and it is **capped at 100 rows** by the server. A member with 240 entries
 *     gets one page, so when the ledger may have been truncated the extract
 *     also says on its face that it is partial.
 *
 * Both sources send an entry as separate `debit` and `credit` columns, so that
 * is the only shape read.
 *
 * Every balance and total is the statement's: `opening_balance`, each entry's
 * `running_balance`, `total_credit`, `total_debit` and `closing_balance`. None
 * is accumulated here, so an extract prints dashes where the statement would
 * have printed its totals.
 */

import { amountInWords } from "../amount-in-words";
import type { PrintableDocument, PrintBlock, PrintChargeLine } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  DASH,
  asArray,
  asRecord,
  currencyOrDash,
  dateOrBlank,
  escapeHtml,
  field,
  formatCurrency,
  generatedAt,
  parseApiDate,
  pick,
  pickNumber,
  presentFields,
  toNumber,
  type PrintableBuildOptions,
} from "./shared";

/** One printed ledger line. A figure the server did not send is null, a dash. */
interface LedgerRow extends Record<string, unknown> {
  date: unknown;
  reference: unknown;
  particulars: unknown;
  debit: number | null;
  credit: number | null;
  balance: number | null;
}

/**
 * How much of the member's ledger this document is standing on.
 *
 * Only `complete` may certify a balance — the others describe a document that
 * is deliberately not a certificate. `partial` is a capped page of a longer
 * ledger; `unbalanced` is every entry but no closing balance from the server
 * (the list fallback), which can only be printed as an extract.
 */
type Coverage = "complete" | "partial" | "unbalanced" | "unavailable";

/**
 * Normalise a `shareCapitalService.ledgerList()` response into a payload this
 * template can read, recording whether the server may have capped it.
 *
 * Lives here rather than in `catalog.ts` so the truncation rule is unit-tested
 * next to the document that depends on it.
 *
 * `meta.total` is the precise signal, and `ledgerList()` reads through
 * `api.getRaw()`, which keeps it. When a response carries none, the fallback
 * signal is the row count against the page size we asked for. That errs toward
 * calling an exactly-full page partial, which is the right direction to be
 * wrong in: the cost is a certificate reprinted once the statement endpoint is
 * up, against certifying a balance that is missing entries.
 */
export function toShareCapitalLedgerFallback(
  raw: unknown,
  pageSize: number
): Record<string, unknown> {
  const entries = asArray(raw);
  const total = pickNumber(asRecord(asRecord(raw)?.meta), ["total"]);

  return {
    entries,
    partial_ledger:
      total === null ? entries.length >= pageSize : total > entries.length,
  };
}

function entryTime(entry: Record<string, unknown>): number | null {
  const parsed = parseApiDate(pick(entry, ["date", "entry_date", "created_at"]));
  return parsed === null ? null : parsed.getTime();
}

/**
 * Entries in `(date, id)` order, oldest first.
 *
 * The order a ledger reads in, and the order the statement endpoint already
 * returns — sorting it is a no-op there and the fix for the descending list. Undated entries sort last and keep their relative
 * order rather than being dropped or landing at the start of the ledger.
 */
function oldestFirst(
  entries: Record<string, unknown>[]
): Record<string, unknown>[] {
  return entries
    .map((entry, index) => ({
      entry,
      index,
      time: entryTime(entry),
      id: toNumber(pick(entry, ["id"])),
    }))
    .sort((a, b) => {
      if (a.time !== b.time) {
        if (a.time === null) return 1;
        if (b.time === null) return -1;
        return a.time - b.time;
      }
      if (a.id !== b.id) {
        if (a.id === null) return 1;
        if (b.id === null) return -1;
        return a.id - b.id;
      }
      return a.index - b.index;
    })
    .map((row) => row.entry);
}

export function buildShareCapitalCertificateDoc(
  raw: unknown,
  options: PrintableBuildOptions = {}
): PrintableDocument {
  const asOf = options.now ?? new Date();
  const root = asRecord(raw);
  const entries = oldestFirst(
    asArray(pick(root, ["entries", "data", "ledger", "transactions"]) ?? raw)
  );

  const closingBalance = pickNumber(root, ["closing_balance", "ending_balance"]);

  const coverage: Coverage =
    root === null && !Array.isArray(raw)
      ? "unavailable"
      : pick(root, ["partial_ledger"]) === true
        ? "partial"
        : closingBalance === null
          ? "unbalanced"
          : "complete";
  const certifies = coverage === "complete";
  /** Printed as a ledger extract: the entries, but no balance stated. */
  const extract = coverage === "partial" || coverage === "unbalanced";

  const borrower =
    asRecord(pick(root, ["borrower", "member"])) ??
    // The list endpoint has no borrower block; every row carries the member.
    (entries.length > 0 ? entries[0]! : null);

  const memberName =
    pick(borrower, ["full_name", "name", "borrower_name"]) ??
    pick(root, ["borrower_name"]);
  const memberCode = pick(borrower, ["borrower_code", "member_no", "code"]);

  const openingBalance = pickNumber(root, ["opening_balance", "beginning_balance"]);

  const rows: LedgerRow[] = entries.map((entry) => ({
    date: pick(entry, ["date", "entry_date", "created_at"]),
    reference: pick(entry, ["reference", "reference_number"]),
    particulars: pick(entry, ["description", "particulars", "remarks"]),
    debit: toNumber(entry.debit),
    credit: toNumber(entry.credit),
    // The statement's running balance; the list fallback sends none.
    balance: toNumber(pick(entry, ["running_balance", "balance"])),
  }));

  const periodBlock = asRecord(pick(root, ["period", "totals", "summary"]));
  const totalCredits =
    pickNumber(root, ["total_credit"]) ?? pickNumber(periodBlock, ["credits", "total_credits"]);
  const totalDebits =
    pickNumber(root, ["total_debit"]) ?? pickNumber(periodBlock, ["debits", "total_debits"]);
  const withdrawn = (value: number | null) =>
    value === null ? DASH : `(${formatCurrency(value)})`;

  const subtitle =
    coverage === "complete"
      ? "Statement of Member's Share Capital"
      : coverage === "partial"
        ? "PARTIAL LEDGER EXTRACT — NOT A CERTIFICATION OF BALANCE"
        : coverage === "unbalanced"
          ? "LEDGER EXTRACT — NOT A CERTIFICATION OF BALANCE"
          : "BLANK FORM — MEMBER RECORD UNAVAILABLE";

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Share Capital Certificate",
      subtitle,
    },
    {
      kind: "fields",
      columns: 2,
      items: presentFields([
        field("Member", memberName),
        field("Member No.", memberCode),
        field("As of", dateOrBlank(asOf)),
        field("Entries covered", rows.length),
        coverage === "partial"
          ? field("Ledger coverage", "Partial — earlier entries not shown")
          : null,
      ]),
    },
  ];

  // The certifying clause is the whole legal weight of this document. It is
  // stated only when the full ledger is in hand; otherwise the paragraph in its
  // place says exactly what the reader is holding instead.
  if (certifies) {
    blocks.push({
      kind: "paragraph",
      html:
        "This is to certify that " +
        `<strong>${escapeHtml(memberName ? String(memberName) : "_______________")}</strong> ` +
        "is a member of the cooperative and, per the books of account as of " +
        `<strong>${escapeHtml(dateOrBlank(asOf))}</strong>, holds paid-up share capital in the ` +
        `amount of <strong>${escapeHtml(currencyOrDash(closingBalance))}</strong> ` +
        `(${escapeHtml(closingBalance === null ? DASH : amountInWords(closingBalance))}).`,
    });
  } else if (coverage === "unbalanced") {
    blocks.push({
      kind: "paragraph",
      html:
        "<strong>This document is an extract of the share capital ledger of </strong>" +
        `<strong>${escapeHtml(memberName ? String(memberName) : "_______________")}</strong>` +
        "<strong>, not a certificate.</strong> The member's share capital statement, which " +
        "carries the balances, could not be retrieved, so this lists the entries only. It " +
        "does <strong>not</strong> state the member's paid-up share capital balance and must " +
        "not be issued or relied upon as proof of it. Print the Share Capital Certificate " +
        "again once the full statement is available.",
    });
  } else if (coverage === "partial") {
    blocks.push({
      kind: "paragraph",
      html:
        "<strong>This document is a partial extract of the share capital ledger of </strong>" +
        `<strong>${escapeHtml(memberName ? String(memberName) : "_______________")}</strong>` +
        "<strong>, not a certificate.</strong> Only the entries listed below could be " +
        "retrieved; earlier entries exist on the member's ledger and are not shown here. " +
        "It therefore does <strong>not</strong> state the member's paid-up share capital " +
        "balance and must not be issued or relied upon as proof of it. Print the Share " +
        "Capital Certificate again once the full statement is available.",
    });
  } else {
    blocks.push({
      kind: "paragraph",
      html:
        "<strong>The member's share capital record could not be retrieved when this form " +
        "was printed</strong>, so no balance is stated on it. This is a blank form: it " +
        "certifies nothing until it has been completed from the cooperative's books and " +
        "signed by the officers named below.",
    });
  }

  blocks.push({
    kind: "table",
    title:
      coverage === "partial"
        ? "Share Capital Ledger (partial extract)"
        : coverage === "unbalanced"
          ? "Share Capital Ledger (extract)"
          : "Share Capital Ledger",
    columns: [
      { key: "date", header: "Date", format: "date", width: "14%" },
      { key: "reference", header: "Reference", width: "16%" },
      { key: "particulars", header: "Particulars", width: "30%" },
      { key: "debit", header: "Withdrawal", format: "currency", align: "right", width: "13%" },
      { key: "credit", header: "Contribution", format: "currency", align: "right", width: "13%" },
      // A running balance over a partial extract is a running total of the
      // extract, not of the member's ledger, so the column is dropped rather
      // than printed with a caveat nobody reads.
      ...(certifies
        ? [
            {
              key: "balance",
              header: "Balance",
              format: "currency" as const,
              align: "right" as const,
              width: "14%",
            },
          ]
        : []),
    ],
    rows,
    totals:
      rows.length > 0
        ? {
            particulars: "TOTAL",
            debit: currencyOrDash(totalDebits),
            credit: currencyOrDash(totalCredits),
            ...(certifies ? { balance: currencyOrDash(closingBalance) } : {}),
          }
        : undefined,
    emptyText:
      coverage === "unavailable"
        ? "The member's share capital ledger could not be retrieved. Complete this form from the cooperative's books."
        : "No share capital entries have been recorded for this member.",
  });

  const summaryLines: PrintChargeLine[] =
    extract
      ? // No opening balance and no closing balance: neither is knowable from
        // an extract. The list sends no totals either, so these are dashes
        // unless the server sent them; the rows are never added up here.
        [
          {
            label: "Contributions (entries shown)",
            amount: currencyOrDash(totalCredits),
          },
          {
            label: "Withdrawals (entries shown)",
            amount: withdrawn(totalDebits),
          },
        ]
      : [
          {
            label: "Opening Balance",
            amount: certifies ? currencyOrDash(openingBalance) : BLANK_LINE,
          },
          {
            label: "Add: Contributions",
            amount: certifies ? currencyOrDash(totalCredits) : BLANK_LINE,
            indent: true,
          },
          {
            label: "Less: Withdrawals",
            amount: certifies ? withdrawn(totalDebits) : BLANK_LINE,
            indent: true,
          },
          {
            label: "CLOSING SHARE CAPITAL BALANCE",
            amount: certifies ? currencyOrDash(closingBalance) : BLANK_LINE,
            rule: "grand",
          },
        ];

  blocks.push({
    kind: "charges",
    title: extract ? "Total of Entries Shown" : "Summary",
    lines: summaryLines,
  });

  if (!extract) {
    blocks.push({
      kind: "fields",
      items: [
        certifies
          ? {
              label: "Balance in words",
              value: closingBalance === null ? DASH : amountInWords(closingBalance),
            }
          : { label: "Balance in words", underline: true },
      ],
    });
  }

  if (coverage === "partial") {
    blocks.push({
      kind: "note",
      text:
        "PARTIAL EXTRACT — the ledger listing is capped at 100 entries per page and this " +
        "member has more. No balance may be certified from it. Ask for the member's full " +
        "Share Capital Statement before issuing a certificate.",
    });
  }

  blocks.push(
    {
      kind: "note",
      text:
        "Share capital is not a deposit and is not withdrawable on demand. It may be " +
        "transferred or refunded only in accordance with the cooperative's by-laws and the " +
        "Cooperative Code of the Philippines.",
    },
    {
      kind: "signatures",
      columns: 2,
      // Nobody countersigns a document that certifies nothing: "Certified
      // correct by" over a partial extract is the signature that makes it
      // look like a certificate.
      blocks: certifies
        ? [
            { label: "Certified correct by", detail: "Bookkeeper" },
            { label: "Approved by", detail: "Treasurer / General Manager" },
          ]
        : [
            { label: "Prepared by", detail: "Bookkeeper" },
            { label: "Checked by", detail: "Treasurer / General Manager" },
          ],
    }
  );

  const footerNote = certifies
    ? memberCode
      ? `Share Capital Certificate • Member ${memberCode}`
      : undefined
    : coverage === "partial"
      ? "PARTIAL LEDGER EXTRACT — not a Share Capital Certificate"
      : coverage === "unbalanced"
        ? "LEDGER EXTRACT — not a Share Capital Certificate"
        : "BLANK FORM — member share capital record unavailable";

  return {
    id: "share_capital_certificate",
    org: options.org ?? BLANK_ORG,
    title: "Share Capital Certificate",
    generatedAt: generatedAt(options.now),
    blocks,
    incomplete: certifies ? undefined : true,
    footerNote,
  };
}
