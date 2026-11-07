import type { PasswordRules } from "@/types/portal";

/** What the portal asks for when its settings have not loaded. */
export const DEFAULT_PASSWORD_RULES: PasswordRules = {
  min_length: 8,
  require_uppercase: true,
  require_number: true,
  require_symbol: false,
};

export interface PasswordCheck {
  label: string;
  met: boolean;
}

/**
 * The cooperative's password rules, each with whether `password` meets it.
 * Shown as a live checklist; the server enforces the same rules on submit.
 */
export function checkPassword(password: string, rules: PasswordRules): PasswordCheck[] {
  const checks: PasswordCheck[] = [
    { label: `At least ${rules.min_length} characters`, met: password.length >= rules.min_length },
  ];
  if (rules.require_uppercase) {
    checks.push({ label: "An uppercase letter", met: /[A-Z]/.test(password) });
  }
  if (rules.require_number) {
    checks.push({ label: "A number", met: /\d/.test(password) });
  }
  if (rules.require_symbol) {
    checks.push({ label: "A symbol, such as ! or #", met: /[^A-Za-z0-9]/.test(password) });
  }
  return checks;
}

/** Null when the new password can be sent, otherwise what to tell the member. */
export function passwordProblem(
  password: string,
  confirmation: string,
  rules: PasswordRules,
): string | null {
  const unmet = checkPassword(password, rules).filter((c) => !c.met);
  if (unmet.length) return `Your password needs: ${unmet.map((c) => c.label.toLowerCase()).join(", ")}.`;
  if (password !== confirmation) return "The two passwords do not match.";
  return null;
}
