import type { MemberOption } from "@/hooks/use-member-search";
import type { Loan } from "@/types";

/**
 * The form's member picker.
 *
 * A new application picks its member. An edit can't change it: the member is
 * fixed when the application is created (`PUT /loans/{id}` takes no
 * `borrower_id`), and re-picking one used to clear the form's collaterals, so
 * saving detached them all. In edit mode the picker is locked and shows the
 * loan's member, by the name the form knows or, failing that (a role without
 * `borrowers:view`), from the loan itself.
 */
export function memberPicker(
  isEditMode: boolean,
  pickedName: string | null,
  loanMemberName: string | null,
): { locked: boolean; label: string | null } {
  if (!isEditMode) return { locked: false, label: pickedName };
  return { locked: true, label: pickedName ?? loanMemberName };
}

/**
 * The members a saved loan already names: its member and its co-makers. The
 * forms show these without searching. A co-maker with no member record (no
 * `borrower_id`) can't be a picked member, so it isn't one here.
 */
export function loanMemberOptions(loan: Loan): MemberOption[] {
  const options: MemberOption[] = [];
  const memberId = loan.borrower?.id ?? loan.borrower_id;
  const memberName = loan.borrower?.full_name ?? loan.borrower?.name;
  if (memberId && memberName) {
    options.push({
      id: Number(memberId),
      full_name: memberName,
      ...(loan.borrower?.borrower_code ? { borrower_code: loan.borrower.borrower_code } : {}),
    });
  }
  for (const coMaker of loan.co_makers ?? []) {
    const name = coMaker.full_name ?? coMaker.name;
    if (typeof coMaker.borrower_id === "number" && name) {
      options.push({ id: coMaker.borrower_id, full_name: name });
    }
  }
  return options;
}
