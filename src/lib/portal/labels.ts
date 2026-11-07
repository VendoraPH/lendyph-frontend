import type {
  PortalAccountStatus,
  PortalDisableReason,
  PortalLoginIdentifier,
  ProfileRequestStatus,
  ProfileUpdateField,
} from "@/types/portal";

export type Tone = "success" | "warning" | "danger" | "muted" | "info";

export const ACCOUNT_STATUS: Record<PortalAccountStatus, { label: string; tone: Tone }> = {
  not_invited: { label: "Not invited", tone: "muted" },
  invitation_sent: { label: "Invitation sent", tone: "info" },
  registered: { label: "Registered", tone: "info" },
  active: { label: "Active", tone: "success" },
  locked: { label: "Locked", tone: "warning" },
  disabled: { label: "Disabled", tone: "danger" },
};

export const DISABLE_REASONS: Record<PortalDisableReason, string> = {
  member_request: "Member request",
  membership_terminated: "Membership terminated",
  security_concern: "Security concern",
  deceased: "Deceased member",
  duplicate_account: "Duplicate account",
  administrative: "Administrative decision",
};

export const REQUEST_STATUS: Record<ProfileRequestStatus, { label: string; tone: Tone }> = {
  submitted: { label: "Submitted", tone: "info" },
  under_review: { label: "Under review", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Not approved", tone: "danger" },
  need_info: { label: "More information needed", tone: "warning" },
};

export const PROFILE_FIELDS: Record<ProfileUpdateField, string> = {
  address: "Address",
  mobile: "Mobile number",
  email: "Email address",
  civil_status: "Civil status",
  occupation: "Occupation",
  employer: "Employer",
  beneficiary: "Beneficiary",
};

export const IDENTIFIER_LABELS: Record<PortalLoginIdentifier, string> = {
  email: "Email address",
  mobile: "Mobile number",
  membership_number: "Membership number",
};

/** Tailwind classes for a status pill. */
export const TONE_CLASS: Record<Tone, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  muted: "bg-muted text-muted-foreground",
};

/** A server status the frontend has no label for still reads sensibly. */
export function humanize(value: string): string {
  const s = value.replace(/_/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

/** Membership status tone: anything not active reads as a warning, closures as danger. */
export function membershipTone(status: string): Tone {
  if (status === "active") return "success";
  if (["withdrawn", "closed", "deceased", "suspended"].includes(status)) return "danger";
  return "warning";
}

/**
 * What a staff member may do to an account in this status. The server enforces
 * the same transitions; this only decides which buttons show.
 */
export function accountActions(status: PortalAccountStatus): {
  invite: boolean;
  resend: boolean;
  unlock: boolean;
  disable: boolean;
  enable: boolean;
} {
  return {
    invite: status === "not_invited",
    resend: status === "invitation_sent",
    unlock: status === "locked",
    disable: status !== "disabled" && status !== "not_invited",
    enable: status === "disabled",
  };
}
