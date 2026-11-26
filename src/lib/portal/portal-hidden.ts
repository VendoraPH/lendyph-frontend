import { httpStatusOf } from "@/lib/api-error";
import { DEFAULT_PASSWORD_RULES } from "./password-rules";
import type { PortalConfig } from "./types";

/**
 * Menu Visibility can hide the Member Portal (finish run round 6). The server
 * then answers 404 on every portal route, its public config included, and the
 * portal says so in words instead of showing an error.
 */
export const PORTAL_HIDDEN_WORDS = "The member portal isn't available right now.";

let hidden = false;

/** Whether this tab has seen the portal's config answer 404. */
export function portalHidden(): boolean {
  return hidden;
}

export function markPortalHidden(): void {
  hidden = true;
}

/** For tests, and when the config answers again. */
export function resetPortalHidden(): void {
  hidden = false;
}

/** The public config answered 404: only a hidden portal does that. */
export function configAnswerHidden(err: unknown): boolean {
  return httpStatusOf(err) === 404;
}

/** A hidden portal's config: switched off, so the sign-in page shows its "not available" state. */
export function hiddenPortalConfig(): PortalConfig {
  return {
    enabled: false,
    portal_name: null,
    logo_url: null,
    welcome_message: null,
    support_contact: null,
    password_rules: DEFAULT_PASSWORD_RULES,
    otp_required: false,
    session_minutes: 0,
    idle_minutes: 0,
    terms: null,
    features: {},
    dashboard_cards: [],
  };
}
