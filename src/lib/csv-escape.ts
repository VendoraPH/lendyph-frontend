/**
 * RFC 4180 quoting, in one place, for every CSV this app writes.
 *
 * Extracted because there were two copies: the reports exporter and the import
 * error report. They had already drifted — one of them handled a lone `\r` and
 * the other did not — which is the ordinary way a duplicated escaper fails. It
 * does not fail loudly; it produces a file that opens, with the columns shifted.
 */

/**
 * Quote a field if it contains anything that would otherwise end it early.
 *
 * The `\r` is not decoration. A lone carriage return — from a CSV written on a
 * classic Mac, or a value pasted out of one — terminates the record in most
 * parsers just as `\n` does, so an unquoted one splits the row in two and every
 * value after it lands under the wrong heading. Excel then shows a plausible,
 * silently wrong table.
 */
export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** One record. `null`/`undefined` become empty cells rather than "null". */
export function csvRow(values: (string | null | undefined)[]): string {
  return values.map((v) => csvEscape(v ?? "")).join(",");
}

/**
 * Stop a spreadsheet treating an exported cell as a formula.
 *
 * A cell beginning `=`, `+`, `-` or `@` is evaluated on open, so a value
 * carried out of a co-op's own CSV and back into an admin's Excel can run
 * `=HYPERLINK(...)` or a DDE payload. Leading tab and CR are included because
 * Excel skips them and evaluates what follows.
 *
 * The prefix is `'` + TAB, deliberately, copied character-for-character from
 * `CsvExportTrait::streamCsv` in the API (app/Http/Controllers/Api/Traits/
 * CsvExportTrait.php) rather than invented here. The admin receives a
 * server-generated error report AND a client-generated one, often for the same
 * data, and the same cell escaped two different ways across two files is worse
 * than either scheme on its own — it reads as corruption. Matching a documented
 * house behaviour is also defensible in a way a novel one is not.
 *
 * First character only, matching the backend: this is about what the parser
 * does at the start of a cell, and prefixing every value containing an `=`
 * would mangle far more than it protects.
 *
 * NOT folded into `csvEscape`, and that is load-bearing: report exports are
 * full of negative currency ("-352,800.00"), and neutralising by default would
 * put `'\t` in front of every negative figure in every financial report.
 * Callers opt in for untrusted values.
 */
export function neutraliseCsvFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'\t${value}` : value;
}
