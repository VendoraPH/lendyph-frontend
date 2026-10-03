import { formatCurrencyExact } from "@/lib/format";

/**
 * Why a Cash Out can't be recorded at this charge, or null when it can.
 *
 * The member receives the total (amount − charge), so a total of zero or less
 * pays out nothing. The server refuses it with a 422 on `amount`, and so does
 * the dialog. Null too while there is no charge or total yet: the tier notice
 * explains that case.
 */
export function cashOutTotalIssue(
  charge: number | null,
  total: number | null,
): string | null {
  if (charge === null || total === null) return null;
  return total > 0 ? null : `Amount must be more than the ${formatCurrencyExact(charge)} charge.`;
}
