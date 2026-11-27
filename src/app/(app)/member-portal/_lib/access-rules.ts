import { escapeHtml } from "@/lib/html-escape";
import type { PortalAccessCard, PortalCodeKind, PortalCodeSlip } from "@/types/portal-admin";

/**
 * Which actions a member's portal access card offers, from the server's state.
 * The server still checks each one (and its permission): these only decide
 * what the card shows.
 */
export interface AccessOffer {
  /** Issue an activation code: "Invite" for a member never invited, "Issue new code" for one invited. */
  invite: "invite" | "reissue" | null;
  /** A password reset code, for an active or locked account. */
  resetCode: boolean;
  unlock: boolean;
  signOut: boolean;
  disable: boolean;
  enable: boolean;
  /** Why turning access back on isn't offered, in words, or null. */
  enableBlocked: string | null;
}

/** Reasons a membership ended; access stays off while they last. */
const MEMBERSHIP_ENDED = new Set(["membership_ended", "deceased"]);

export function accessOffer(card: Pick<PortalAccessCard, "state" | "disabled_reason" | "member">): AccessOffer {
  const { state } = card;
  const memberActive = card.member.status === "active";
  const ended = state === "disabled" && MEMBERSHIP_ENDED.has(card.disabled_reason ?? "");
  return {
    invite: state === "not_invited" ? "invite" : state === "invited" ? "reissue" : null,
    resetCode: (state === "active" || state === "locked") && memberActive,
    unlock: state === "locked",
    signOut: state === "active" || state === "locked",
    disable: state === "invited" || state === "active" || state === "locked",
    enable: state === "disabled" && !ended,
    enableBlocked: ended ? "This membership has ended, so portal access stays off." : null,
  };
}

/** The code dialog's question, each written out in full so the article always fits. */
export function issueCodeTitle(kind: PortalCodeKind): string {
  return kind === "reset" ? "Issue a password reset code?" : "Issue an activation code?";
}

/** Why an invite can't be issued yet, in words, or null (the server checks it again). */
export function inviteBlocked(card: Pick<PortalAccessCard, "member">): string | null {
  if (card.member.status !== "active") return "Only an active member can be invited to the portal.";
  if (!card.member.has_birthdate) return "Add the member's birthdate first: members confirm it when they use their code.";
  return null;
}

/**
 * The portal's full address from the app's own origin and the slip's path
 * ("/member"). The server sends a path only, so a slip never carries another
 * host. Anything but a plain same-site path gives null.
 */
export function portalAddress(origin: string, path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  try {
    const base = new URL(origin);
    if (base.protocol !== "https:" && base.protocol !== "http:") return null;
    const url = new URL(path, base);
    return url.origin === base.origin ? url.href.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

/** The printable slip: name, number, code, expiry and the three steps. No balances. */
export function slipHtml(slip: PortalCodeSlip, address: string | null, cooperative: string): string {
  const steps = slip.instructions.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(slip.title)}</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:24px;color:#111}
.slip{max-width:420px;border:1px dashed #888;padding:20px;border-radius:8px}
h1{font-size:16px;margin:0 0 4px}.org{font-size:12px;color:#555;margin:0 0 16px}
dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:14px;margin:0 0 16px}
dt{color:#555}dd{margin:0;font-weight:600}
.code{font-family:ui-monospace,Menlo,monospace;font-size:22px;letter-spacing:2px}
ol{font-size:13px;padding-left:18px;margin:0}
@media print{button{display:none}body{margin:0}}
</style></head><body><div class="slip">
<h1>${escapeHtml(slip.title)}</h1><p class="org">${escapeHtml(cooperative)}</p>
<dl><dt>Member</dt><dd>${escapeHtml(slip.member_name)}</dd>
<dt>Member number</dt><dd>${escapeHtml(slip.member_number)}</dd>
<dt>Code</dt><dd class="code">${escapeHtml(slip.code)}</dd>
<dt>Valid until</dt><dd>${escapeHtml(slip.expires_at_text)}</dd>
<dt>Portal</dt><dd>${escapeHtml(address ?? slip.portal_path)}</dd></dl>
<ol>${steps}</ol></div>
<p><button type="button" onclick="window.print()">Print</button></p></body></html>`;
}
