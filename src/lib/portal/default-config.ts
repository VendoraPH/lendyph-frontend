import type { PortalConfig } from "@/types/portal";
import { DEFAULT_PASSWORD_RULES } from "./password-rules";

/**
 * What the portal shows before GET /portal/config answers, or when it cannot.
 * Every module is on so nothing a cooperative turned on is hidden by a slow
 * request; a screen whose own endpoint is missing still says "Not connected yet".
 */
export const DEFAULT_PORTAL_CONFIG: PortalConfig = {
  enabled: true,
  portal_name: "Member Portal",
  logo_url: null,
  welcome_message: null,
  support_contact: null,
  login_identifiers: ["membership_number", "mobile", "email"],
  self_registration: true,
  otp_method: "sms",
  password_rules: DEFAULT_PASSWORD_RULES,
  terms_version: "1",
  terms_url: null,
  privacy_url: null,
  features: {
    share_capital: true,
    savings: true,
    time_deposits: true,
    loans: true,
    credit_score: "hidden",
    documents: true,
    loan_applications: true,
    withdrawal_requests: true,
    profile_updates: true,
    gcash_payments: false,
    statements: true,
  },
  dashboard_cards: ["share_capital", "savings", "time_deposits", "loans", "next_payment", "announcements"],
};

/** A partial or older server payload, filled out to the full shape. */
export function withConfigDefaults(raw: Partial<PortalConfig> | null | undefined): PortalConfig {
  if (!raw) return DEFAULT_PORTAL_CONFIG;
  return {
    ...DEFAULT_PORTAL_CONFIG,
    ...raw,
    password_rules: { ...DEFAULT_PASSWORD_RULES, ...raw.password_rules },
    features: { ...DEFAULT_PORTAL_CONFIG.features, ...raw.features },
    login_identifiers: raw.login_identifiers?.length
      ? raw.login_identifiers
      : DEFAULT_PORTAL_CONFIG.login_identifiers,
    dashboard_cards: raw.dashboard_cards ?? DEFAULT_PORTAL_CONFIG.dashboard_cards,
  };
}
