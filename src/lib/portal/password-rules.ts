import type { PasswordRules } from "./types";

/** The server's password rule, when `/portal/config` hasn't answered yet (portal design §1). */
export const DEFAULT_PASSWORD_RULES: PasswordRules = {
  min_length: 10,
  max_length: 128,
  needs_letter: true,
  needs_number: true,
  no_member_number: true,
};

export interface PasswordHint {
  text: string;
  /** Null for a rule only the server can check. */
  met: boolean | null;
}

/**
 * The rule as a checklist beside the password field. A hint only: the server
 * decides (the member number check, in particular, is its own), and its 422
 * is shown in its own words.
 */
export function passwordHints(password: string, rules: PasswordRules = DEFAULT_PASSWORD_RULES): PasswordHint[] {
  const hints: PasswordHint[] = [
    {
      text: `${rules.min_length} to ${rules.max_length} characters`,
      met: password.length >= rules.min_length && password.length <= rules.max_length,
    },
  ];
  if (rules.needs_letter) hints.push({ text: "At least one letter", met: /\p{L}/u.test(password) });
  if (rules.needs_number) hints.push({ text: "At least one number", met: /\p{N}/u.test(password) });
  if (rules.no_member_number) hints.push({ text: "Doesn't contain your member number", met: null });
  return hints;
}

/** True when the hints the browser can check are all met and both entries match. */
export function passwordReady(password: string, confirmation: string, rules: PasswordRules = DEFAULT_PASSWORD_RULES): boolean {
  return password === confirmation && passwordHints(password, rules).every((hint) => hint.met !== false);
}
