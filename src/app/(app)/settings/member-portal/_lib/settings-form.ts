import type {
  PortalDashboardCard,
  PortalFeature,
  PortalSettings,
  PortalSettingsInput,
  PortalTermsInput,
  PortalWithdrawalMethod,
} from "@/types/portal-admin";

/**
 * The Member Portal settings form: the inputs as typed, the server's ranges
 * (`UpdatePortalSettingsRequest`), and a body holding only what changed, so a
 * save never resends a switch someone else changed meanwhile. There is no
 * self-registration, sign-in identifier or OTP method to set: the portal
 * signs in by member number, with codes issued by staff.
 */

/** The whole-number settings, with the server's ranges and their words. */
export const NUMBER_FIELDS = [
  { key: "session_minutes", label: "Session length (minutes)", min: 15, max: 240 },
  { key: "idle_minutes", label: "Sign out after idle (minutes)", min: 5, max: 60 },
  { key: "max_login_attempts", label: "Wrong passwords before a lockout", min: 3, max: 10 },
  { key: "lockout_minutes", label: "Lockout (minutes)", min: 5, max: 1440 },
  { key: "hard_lock_after", label: "Lockouts in a day before staff must unlock", min: 2, max: 10 },
  { key: "password_min_length", label: "Shortest password (characters)", min: 10, max: 128 },
  { key: "activation_code_hours", label: "Activation code lasts (hours)", min: 24, max: 168 },
  { key: "reset_code_hours", label: "Password reset code lasts (hours)", min: 1, max: 72 },
  { key: "withdrawal_hold_days", label: "Withdrawal request holds money for (days)", min: 1, max: 30 },
  { key: "request_expiry_days", label: "Other requests expire after (days)", min: 1, max: 90 },
] as const;

export type NumberKey = (typeof NUMBER_FIELDS)[number]["key"];

export interface SettingsForm {
  enabled: boolean;
  portal_name: string;
  welcome_message: string;
  support_contact: string;
  payment_instructions: string;
  otp_required: boolean;
  numbers: Record<NumberKey, string>;
  features: Partial<Record<PortalFeature, boolean>>;
  dashboard_cards: PortalDashboardCard[];
  withdrawal_methods: PortalWithdrawalMethod[];
}

export function formOf(s: PortalSettings): SettingsForm {
  const numbers = Object.fromEntries(NUMBER_FIELDS.map((f) => [f.key, String(s[f.key])])) as Record<NumberKey, string>;
  return {
    enabled: s.enabled,
    portal_name: s.portal_name ?? "",
    welcome_message: s.welcome_message ?? "",
    support_contact: s.support_contact ?? "",
    payment_instructions: s.payment_instructions ?? "",
    otp_required: s.otp_required,
    numbers,
    features: { ...s.features },
    dashboard_cards: [...s.dashboard_cards],
    withdrawal_methods: [...s.withdrawal_methods],
  };
}

function wholeIn(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const n = Number(text.trim());
  return n >= min && n <= max ? n : null;
}

/** What the server would refuse, in words, by field. */
export function settingsProblems(form: SettingsForm): Partial<Record<NumberKey | "portal_name" | "withdrawal_methods", string>> {
  const problems: Partial<Record<NumberKey | "portal_name" | "withdrawal_methods", string>> = {};
  for (const f of NUMBER_FIELDS) {
    if (wholeIn(form.numbers[f.key], f.min, f.max) === null) problems[f.key] = `Enter a whole number from ${f.min} to ${f.max}.`;
  }
  if (!problems.session_minutes && !problems.idle_minutes) {
    const session = wholeIn(form.numbers.session_minutes, 15, 240);
    const idle = wholeIn(form.numbers.idle_minutes, 5, 60);
    if (session !== null && idle !== null && idle > session) {
      problems.idle_minutes = `The idle timeout can't be longer than the session (${session} minutes).`;
    }
  }
  if (form.portal_name.trim() === "") problems.portal_name = "Give the portal a name.";
  if (form.withdrawal_methods.length === 0) problems.withdrawal_methods = "Keep at least one payout method.";
  return problems;
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

const orNull = (text: string) => (text.trim() === "" ? null : text.trim());

/** Only the settings that changed from what the server sent. */
export function settingsBody(form: SettingsForm, saved: PortalSettings): PortalSettingsInput {
  const body: PortalSettingsInput = {};
  if (form.enabled !== saved.enabled) body.enabled = form.enabled;
  if (form.otp_required !== saved.otp_required) body.otp_required = form.otp_required;
  if (form.portal_name.trim() !== (saved.portal_name ?? "")) body.portal_name = form.portal_name.trim();
  for (const key of ["welcome_message", "support_contact", "payment_instructions"] as const) {
    if (orNull(form[key]) !== (saved[key] ?? null)) body[key] = orNull(form[key]);
  }
  for (const f of NUMBER_FIELDS) {
    const n = Number(form.numbers[f.key].trim());
    if (n !== saved[f.key]) body[f.key] = n;
  }
  const changedFeatures = Object.fromEntries(
    Object.entries(form.features).filter(([k, on]) => (saved.features as Record<string, boolean | undefined>)[k] !== on),
  );
  if (Object.keys(changedFeatures).length > 0) body.features = changedFeatures;
  if (!sameList(form.dashboard_cards, saved.dashboard_cards)) body.dashboard_cards = form.dashboard_cards;
  if (!sameList(form.withdrawal_methods, saved.withdrawal_methods)) body.withdrawal_methods = form.withdrawal_methods;
  return body;
}

/** Whether OTP's switch can be moved: always off again, on only when the server says nothing blocks it. */
export function otpSwitchDisabled(saved: Pick<PortalSettings, "otp_required" | "otp_blocked_reason">): boolean {
  return !saved.otp_required && saved.otp_blocked_reason !== null;
}

export interface TermsForm {
  version: string;
  title: string;
  terms_body: string;
  privacy_body: string;
  consent_body: string;
  requires_reacceptance: boolean;
}

export const EMPTY_TERMS: TermsForm = {
  version: "",
  title: "",
  terms_body: "",
  privacy_body: "",
  consent_body: "",
  requires_reacceptance: false,
};

export function termsProblems(t: TermsForm): string[] {
  const problems: string[] = [];
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]{0,19}$/.test(t.version.trim())) {
    problems.push("Use letters, numbers, dots and dashes for the version (for example 2026-11), up to 20 characters.");
  }
  if (t.title.trim() === "") problems.push("Give the terms a title.");
  if (t.terms_body.trim() === "") problems.push("Write the terms of use.");
  if (t.privacy_body.trim() === "") problems.push("Write the privacy notice.");
  return problems;
}

export function termsBody(t: TermsForm): PortalTermsInput {
  return {
    version: t.version.trim(),
    title: t.title.trim(),
    terms_body: t.terms_body.trim(),
    privacy_body: t.privacy_body.trim(),
    ...(t.consent_body.trim() ? { consent_body: t.consent_body.trim() } : {}),
    requires_reacceptance: t.requires_reacceptance,
  };
}
