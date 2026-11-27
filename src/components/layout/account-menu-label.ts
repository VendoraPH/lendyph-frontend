/**
 * The name of the header's account menu button, which shows only the user's
 * initials: "Account menu for Maria Santos", or "Account menu" before the
 * user's name has loaded.
 */
export function accountMenuLabel(fullName: string | null | undefined): string {
  const name = fullName?.trim();
  return name ? `Account menu for ${name}` : "Account menu";
}
