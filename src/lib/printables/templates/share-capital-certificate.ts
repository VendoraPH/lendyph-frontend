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
 *     back into date order before anything is accumulated. Adding up a
 *     descending ledger from an opening balance produces a reverse-cumulative
 *     in every Balance cell while the footer total stays right — a table that
 *     looks plausible and where no line reconciles;
 *   - it carries no running balance at all (`ShareCapitalLedgerResource` sends
 *     `debit` and `credit` and nothing else), so the balance column is derived
 *     here;
 *   - and it is **capped at 100 rows** by the server. A member with 240 entries
 *     gets one page. A closing balance computed from one page of a longer
 *     ledger is not the member's share capital, so when the ledger may have
 *     been truncated this document stops being a certificate: it drops the
 *     certifying clause and the balance column, says on its face that it is a
 *     partial extract, and is signed as one.
 *
 * Two shapes of entry are read for the same reason: `ShareCapitalLedgerResource`
 * serialises separate `debit` and `credit` columns, while
 * `ShareCapitalLedgerEntry` in `src/types/share-capital.ts` declares a
 * `type` + `amount` pair. The resource is what the API actually sends.
 */

import { amountInWords } from "../amount-in-words";
import type { PrintableDocument, PrintBlock, PrintChargeLine } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  asArray,
  asRecord,
  dateOrBlank,
  escapeHtml,
  field,
  formatCurrency,
  generatedAt,
  parseApiDate,
  pick,
  pickNumber,
  presentFields,
  sum,
  toNumber,
  type PrintableBuildOptions,
} from "./shared";

interface LedgerRow extends Record<string, unknown> {
  date: unknown;
  reference: unknown;
  particulars: unknown;
  debit: number;
  credit: number;
  balance: number;
}

/**
 * How much of the member's ledger this document is standing on.
 *
 * Only `complete` may certify a balance — the other two describe a document
 * that is deliberately not a certificate.
 */
type Coverage = "complete" | "partial" | "unavailable";

/**
 * Normalise a `shareCapitalService.ledgerList()` response into a payload this
 * template can read, recording whether the server may have capped it.
 *
 * Lives here rather than in `catalog.ts` so the truncation rule is unit-tested
 * next to the document that depends on it.
 *
 * `meta.total` is the precise signal and is used when it is there — but note
 * that it usually is not: `api.get()` returns `response.data.data`, which for a
 * Laravel paginator is the row array with the `meta` block already discarded
 * (`api.getRaw()` is the method that keeps it). So the working signal is the
 * row count against the page size we asked for. That errs toward calling an
 * exactly-full page partial, which is the right direction to be wrong in: the
 * cost is a certificate reprinted once the statement endpoint is up, against
 * certifying a balance that is missing entries.
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

/** Split one entry into debit/credit, whichever convention it arrived in. */
function readAmounts(raw: Record<string, unknown>): { debit: number; credit: number } {
  const debit = toNumber(raw.debit);
  const credit = toNumber(raw.credit);
  if (debit !== null || credit !== null) {
    return { debit: debit ?? 0, credit: credit ?? 0 };
  }
  const amount = toNumber(pick(raw, ["amount", "value"])) ?? 0;
  const isDebit = String(pick(raw, ["type", "entry_type"]) ?? "").toLowerCase() === "debit";
  return { debit: isDebit ? amount : 0, credit: isDebit ? 0 : amount };
}

function entryTime(entry: Record<string, unknown>): number | null {
  const parsed = parseApiDate(pick(entry, ["date", "entry_date", "created_at"]));
  return parsed === null ? null : parsed.getTime();
}

/**
 * Entries in `(date, id)` order, oldest first.
 *
 * The only order a running balance can be accumulated in, and the order the
 * statement endpoint already returns — sorting it is a no-op there and the fix
 * for the descending list. Undated entries sort last and keep their relative
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

  const coverage: Coverage =
    root === null && !Array.isArray(raw)
      ? "unavailable"
      : pick(root, ["partial_ledger"]) === true
        ? "partial"
        : "complete";
  const certifies = coverage === "complete";

  const borrower =
    asRecord(pick(root, ["borrower", "member"])) ??
    // The list endpoint has no borrower block; every row carries the member.
    (entries.length > 0 ? entries[0]! : null);

  const memberName =
    pick(borrower, ["full_name", "name", "borrower_name"]) ??
    pick(root, ["borrower_name"]);
  const memberCode = pick(borrower, ["borrower_code", "member_no", "code"]);

  const openingBalance =
    pickNumber(root, ["opening_balance", "beginning_balance"]) ?? 0;

  let running = openingBalance;
  const rows: LedgerRow[] = entries.map((entry) => {
    const { debit, credit } = readAmounts(entry);
    // Prefer the server's running balance; only accumulate when it is absent.
    // Either way the entries have been sorted into date order first, so the
    // accumulation and the supplied figures describe the same sequence.
    const supplied = toNumber(pick(entry, ["running_balance", "balance"]));
    running = supplied ?? Math.round((running + credit - debit) * 100) / 100;
    return {
      date: pick(entry, ["date", "entry_date", "created_at"]),
      reference: pick(entry, ["reference", "reference_number"]),
      particulars: pick(entry, ["description", "particulars", "remarks"]),
      debit,
      credit,
      balance: running,
    };
  });

  const periodBlock = asRecord(pick(root, ["period", "totals", "summary"]));
  const totalCredits =
    pickNumber(periodBlock, ["credits", "total_credits"]) ?? sum(rows, "credit");
  const totalDebits =
    pickNumber(periodBlock, ["debits", "total_debits"]) ?? sum(rows, "debit");
  const closingBalance =
    pickNumber(root, ["closing_balance", "ending_balance"]) ??
    Math.round((openingBalance + totalCredits - totalDebits) * 100) / 100;

  const subtitle =
    coverage === "complete"
      ? "Statement of Member's Share Capital"
      : coverage === "partial"
        ? "PARTIAL LEDGER EXTRACT — NOT A CERTIFICATION OF BALANCE"
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
        `amount of <strong>${escapeHtml(formatCurrency(closingBalance))}</strong> ` +
        `(${escapeHtml(amountInWords(closingBalance))}).`,
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
            debit: formatCurrency(totalDebits),
            credit: formatCurrency(totalCredits),
            ...(certifies ? { balance: formatCurrency(closingBalance) } : {}),
          }
        : undefined,
    emptyText:
      coverage === "unavailable"
        ? "The member's share capital ledger could not be retrieved. Complete this form from the cooperative's books."
        : "No share capital entries have been recorded for this member.",
  });

  const summaryLines: PrintChargeLine[] =
    coverage === "partial"
      ? // No opening balance and no closing balance: neither is knowable from
        // an extract. What IS true of these rows is what they add up to.
        [
          {
            label: "Contributions (entries shown)",
            amount: formatCurrency(totalCredits),
          },
          {
            label: "Withdrawals (entries shown)",
            amount: `(${formatCurrency(totalDebits)})`,
          },
        ]
      : [
          {
            label: "Opening Balance",
            amount: certifies ? formatCurrency(openingBalance) : BLANK_LINE,
          },
          {
            label: "Add: Contributions",
            amount: certifies ? formatCurrency(totalCredits) : BLANK_LINE,
            indent: true,
          },
          {
            label: "Less: Withdrawals",
            amount: certifies ? `(${formatCurrency(totalDebits)})` : BLANK_LINE,
            indent: true,
          },
          {
            label: "CLOSING SHARE CAPITAL BALANCE",
            amount: certifies ? formatCurrency(closingBalance) : BLANK_LINE,
            rule: "grand",
          },
        ];

  blocks.push({
    kind: "charges",
    title: coverage === "partial" ? "Total of Entries Shown" : "Summary",
    lines: summaryLines,
  });

  if (coverage !== "partial") {
    blocks.push({
      kind: "fields",
      items: [
        certifies
          ? { label: "Balance in words", value: amountInWords(closingBalance) }
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
