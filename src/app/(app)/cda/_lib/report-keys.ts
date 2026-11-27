/**
 * The report's key on a CDA report page. The page's own register or figures
 * sit beside it keyed by the plain year, so the report's key carries its own
 * prefix: two siblings with one key make React warn and can mix them up. The
 * key changes only with the year; a register write reads the report again in
 * place (`registerVersion`), which keeps the unsaved edits.
 */
export function reportWorkspaceKey(year: number): string {
  return `report-${year}`;
}
