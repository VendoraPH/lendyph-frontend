import type { SavingsTransaction } from "@/types";
import type { SavingsAccountDetails } from "@/types/savings-servicing";

const DASH = "—";

/**
 * The account's opening details (gap round S1) as the server sent them: the
 * officer, the source of funds in words and the beneficiary. The contact
 * number is null when the caller may not see the member's contact details,
 * and then reads a dash.
 */
export function accountDetailItems(account: SavingsAccountDetails): Array<{ label: string; value: string }> {
  const b = account.beneficiary ?? null;
  const beneficiary = b?.name ? (b.relationship ? `${b.name} (${b.relationship})` : b.name) : DASH;
  return [
    { label: "Account officer", value: account.account_officer?.name ?? DASH },
    { label: "Source of funds", value: account.source_of_funds_label ?? DASH },
    { label: "Beneficiary", value: beneficiary },
    { label: "Beneficiary contact", value: b?.contact_number ?? DASH },
  ];
}

/**
 * Who a ledger line is by. A line posted through an approval carries its
 * maker as `created_by` and its checker as `approved_by`, with the first of
 * two checkers as `first_checker` (gap round B9). A server that names no
 * checker points to the request instead.
 */
export function postedByText(
  txn: Pick<SavingsTransaction, "created_by" | "approval_id" | "approved_by" | "first_checker">,
): {
  primary: string;
  secondary: string | null;
} {
  const name = txn.created_by?.name ?? "System";
  if (!txn.approval_id) return { primary: name, secondary: null };
  const checker = txn.approved_by?.name;
  const first = txn.first_checker?.name;
  const secondary = checker
    ? `Approved by ${first ? `${first} and ${checker}` : checker}`
    : `Approved through request #${txn.approval_id}`;
  return { primary: `Requested by ${name}`, secondary };
}
