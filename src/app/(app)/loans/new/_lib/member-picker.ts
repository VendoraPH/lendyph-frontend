/**
 * The form's member picker.
 *
 * A new application picks its member. An edit can't change it: the member is
 * fixed when the application is created (`PUT /loans/{id}` takes no
 * `borrower_id`), and re-picking one used to clear the form's collaterals, so
 * saving detached them all. In edit mode the picker is locked and shows the
 * loan's member, by its name from the member list or, when the list doesn't
 * have them (a role without `borrowers:view`, or a list cut short), from the
 * loan itself.
 */
export function memberPicker(
  isEditMode: boolean,
  pickedName: string | null,
  loanMemberName: string | null,
): { locked: boolean; label: string | null } {
  if (!isEditMode) return { locked: false, label: pickedName };
  return { locked: true, label: pickedName ?? loanMemberName };
}
