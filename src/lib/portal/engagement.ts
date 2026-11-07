import type {
  ActivityItem,
  AnnouncementAudience,
  AnnouncementInput,
  AnnouncementStatus,
  AutoPayStatus,
  CreditFactorImpact,
  CreditScoreVisibility,
  DividendStatus,
  NotificationCategory,
  NotificationChannel,
  PortalCreditScore,
  PortalDividend,
  PortalNotificationPreference,
  PortalSearchResult,
  SearchResultKind,
  StaffAnnouncement,
  TicketCategory,
  TicketStatus,
} from "@/types/portal";
import { formatDateISO } from "@/lib/format";
import type { Tone } from "./labels";

// ── Credit score ───────────────────────────────────────────────────────────

export interface CreditScoreView {
  category: string | null;
  /** Null unless the cooperative shows scores. */
  score: number | null;
  maxScore: number;
  asOf: string | null;
  /** Empty unless the cooperative shows factors. Labels only: no weights. */
  factors: { label: string; impact: CreditFactorImpact; description: string | null }[];
}

/**
 * What the member may see of their score under the portal's setting. The
 * server should already trim the payload; this makes sure a fuller one never
 * reaches the screen. `null` means show nothing.
 */
export function creditScoreView(data: PortalCreditScore, visibility: CreditScoreVisibility): CreditScoreView | null {
  if (visibility === "hidden") return null;
  const showScore = visibility === "score" || visibility === "score_factors";
  const view: CreditScoreView = {
    category: data.category,
    score: showScore ? data.score : null,
    maxScore: data.max_score || 100,
    asOf: data.as_of,
    factors:
      visibility === "score_factors"
        ? data.factors.map((f) => ({ label: f.label, impact: f.impact, description: f.description ?? null }))
        : [],
  };
  return view.category || view.score !== null ? view : null;
}

/** Colour for a risk category the server names, e.g. "Low risk". */
export function creditCategoryTone(category: string | null): Tone {
  const c = (category ?? "").toLowerCase();
  if (/\b(high|poor)\b/.test(c)) return "danger";
  if (/\b(medium|moderate|fair)\b/.test(c)) return "warning";
  if (/\b(low|excellent|good)\b/.test(c)) return "success";
  return "muted";
}

export const FACTOR_TONE: Record<CreditFactorImpact, Tone> = {
  positive: "success",
  negative: "danger",
  neutral: "muted",
};

// ── Auto-pay ───────────────────────────────────────────────────────────────

export const AUTO_PAY_STATUS: Record<AutoPayStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  pending: { label: "Awaiting approval", tone: "info" },
  cancelled: { label: "Stopped", tone: "muted" },
  failed: { label: "Last run failed", tone: "danger" },
};

export const AUTO_PAY_RUN_STATUS: Record<"success" | "failed" | "skipped", { label: string; tone: Tone }> = {
  success: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  skipped: { label: "Skipped", tone: "muted" },
};

// ── Notifications ──────────────────────────────────────────────────────────

export const NOTIFICATION_CATEGORIES: Record<NotificationCategory, string> = {
  loans: "Loans",
  payments: "Payments",
  savings: "Savings",
  share_capital: "Share capital",
  requests: "Requests",
  announcements: "Announcements",
  security: "Security",
  other: "Other",
};

/** The filter tabs on the notifications page, in order. */
export const NOTIFICATION_FILTERS: NotificationCategory[] = [
  "loans",
  "payments",
  "savings",
  "share_capital",
  "requests",
  "announcements",
];

/**
 * A notification's link, only when it stays inside the member portal. A
 * server bug or a tampered row must not turn the bell into an open redirect.
 */
export function safePortalLink(link: string | null | undefined): string | null {
  if (!link) return null;
  if (!link.startsWith("/member")) return null;
  if (link.startsWith("//") || link.includes("\\") || /^\/member[^/?#]/.test(link)) return null;
  return link;
}

export const CHANNELS: { key: NotificationChannel; label: string; future?: boolean }[] = [
  { key: "in_app", label: "In the portal" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "push", label: "Push", future: true },
];

/** Whether the member may change this switch. */
export function preferenceLocked(pref: PortalNotificationPreference, channel: NotificationChannel): boolean {
  return pref.mandatory || CHANNELS.some((c) => c.key === channel && c.future);
}

/** The preferences with one switch changed, unless that switch is locked. */
export function setPreference(
  prefs: PortalNotificationPreference[],
  category: NotificationCategory,
  channel: NotificationChannel,
  value: boolean,
): PortalNotificationPreference[] {
  return prefs.map((p) =>
    p.category === category && !preferenceLocked(p, channel) ? { ...p, [channel]: value } : p,
  );
}

// ── Announcements ──────────────────────────────────────────────────────────

export const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  all: "All members",
  branch: "Members of a branch",
  member_type: "A member type",
  members: "Selected members",
};

/** Member types a cooperative has under the CDA's rules. */
export const MEMBER_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "associate", label: "Associate" },
];

export const ANNOUNCEMENT_STATUS: Record<AnnouncementStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "muted" },
  scheduled: { label: "Scheduled", tone: "info" },
  published: { label: "Published", tone: "success" },
  expired: { label: "Expired", tone: "muted" },
};

export const EMPTY_ANNOUNCEMENT: AnnouncementInput = {
  title: "",
  body: "",
  audience: "all",
  branch_ids: [],
  member_types: [],
  member_numbers: [],
  publish_at: null,
  expires_at: null,
  pinned: false,
  publish: true,
};

/** The form for editing an existing announcement. */
export function announcementInput(a: StaffAnnouncement | null): AnnouncementInput {
  if (!a) return EMPTY_ANNOUNCEMENT;
  return {
    title: a.title,
    body: a.body,
    audience: a.audience,
    branch_ids: a.branch_ids ?? [],
    member_types: a.member_types ?? [],
    member_numbers: a.member_numbers ?? [],
    // A scheduled one keeps its time; anything already out is not re-dated.
    publish_at: a.status === "scheduled" ? toDateTimeInput(a.published_at) : null,
    expires_at: toDateTimeInput(a.expires_at),
    pinned: a.pinned,
    publish: a.status !== "draft",
  };
}

/** Member numbers typed one per line or separated by commas, de-duplicated. */
export function parseMemberNumbers(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
}

/**
 * An API timestamp (UTC ISO) as the `YYYY-MM-DDTHH:mm` a datetime-local input
 * holds, in the user's own timezone. Slicing the ISO string would show UTC.
 */
export function toDateTimeInput(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDateISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Only the audience fields that apply, so a switched audience sends nothing stale. */
export function announcementBody(input: AnnouncementInput): AnnouncementInput {
  return {
    ...input,
    title: input.title.trim(),
    body: input.body.trim(),
    branch_ids: input.audience === "branch" ? input.branch_ids : [],
    member_types: input.audience === "member_type" ? input.member_types : [],
    member_numbers: input.audience === "members" ? input.member_numbers : [],
    publish_at: input.publish_at || null,
    expires_at: input.expires_at || null,
  };
}

export function announcementProblem(input: AnnouncementInput): string | null {
  if (!input.title.trim()) return "Enter a title.";
  if (!input.body.trim()) return "Write the announcement.";
  if (input.audience === "branch" && input.branch_ids.length === 0) return "Choose at least one branch.";
  if (input.audience === "member_type" && input.member_types.length === 0) return "Choose at least one member type.";
  if (input.audience === "members" && input.member_numbers.length === 0) return "Enter at least one member number.";
  // Both are `YYYY-MM-DDTHH:mm` (or a date), so they compare as text.
  if (input.publish_at && input.expires_at && input.expires_at <= input.publish_at) {
    return "The end date must be after the publish date.";
  }
  return null;
}

// ── Dividends and patronage refunds ────────────────────────────────────────

export const DIVIDEND_STATUS: Record<DividendStatus, { label: string; tone: Tone }> = {
  declared: { label: "Declared", tone: "info" },
  pending: { label: "Being processed", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
};

export const CREDITED_TO: Record<NonNullable<PortalDividend["credited_to"]>, string> = {
  savings: "Credited to savings",
  share_capital: "Added to share capital",
  cash: "Paid in cash",
};

/** Newest year first. */
export function sortDividends(rows: PortalDividend[]): PortalDividend[] {
  return [...rows].sort((a, b) => b.year - a.year);
}

// ── Help and support ───────────────────────────────────────────────────────

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: Tone }> = {
  submitted: { label: "Submitted", tone: "info" },
  open: { label: "Open", tone: "info" },
  in_progress: { label: "In progress", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "muted" },
};

export const TICKET_CATEGORIES: Record<TicketCategory, string> = {
  account: "My account or membership",
  loans: "Loans",
  payments: "Payments",
  savings: "Savings and share capital",
  portal: "Using the portal",
  other: "Something else",
};

/** A member can add to a ticket until it is closed. */
export function canReplyToTicket(status: TicketStatus): boolean {
  return status !== "closed";
}

export function ticketProblem(form: { subject: string; message: string }): string | null {
  if (!form.subject.trim()) return "Enter a subject.";
  if (form.subject.trim().length > 150) return "Keep the subject under 150 characters.";
  if (!form.message.trim()) return "Describe what you need help with.";
  return null;
}

/** Group FAQs by category, keeping the server's order inside each. */
export function groupBy<T>(rows: T[], key: (row: T) => string): { key: string; rows: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    groups.set(k, [...(groups.get(k) ?? []), row]);
  }
  return [...groups].map(([k, r]) => ({ key: k, rows: r }));
}

/** FAQs whose question or answer contains every word typed. */
export function filterFaqs<T extends { question: string; answer: string }>(rows: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return rows;
  return rows.filter((r) => {
    const text = `${r.question} ${r.answer}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

// ── Activity history ───────────────────────────────────────────────────────

export const ACTIVITY_KINDS: Record<ActivityItem["kind"], string> = {
  loan_payment: "Loan payments",
  savings: "Savings",
  share_capital: "Share capital",
  loan: "Loans",
  request: "Requests",
  other: "Other",
};

/** The activity grouped by day (`YYYY-MM-DD`), in the order received. */
export function groupActivityByDay(items: ActivityItem[]): { key: string; rows: ActivityItem[] }[] {
  return groupBy(items, (item) => item.date.slice(0, 10));
}

// ── Search ─────────────────────────────────────────────────────────────────

export const MIN_SEARCH_LENGTH = 2;

export const SEARCH_KINDS: Record<SearchResultKind, string> = {
  transaction: "Transaction",
  loan: "Loan",
  document: "Document",
  receipt: "Receipt",
  statement: "Statement",
  request: "Request",
};

/** Where a result opens. Only portal paths, built here rather than taken from the server. */
export function searchHref(result: PortalSearchResult): string {
  switch (result.kind) {
    case "loan":
      return `/member/loans/${result.id}`;
    case "document":
      return "/member/documents";
    case "receipt":
      return "/member/payments";
    case "statement":
      return "/member/statements";
    case "request":
      return "/member/requests";
    default:
      return "/member/activity";
  }
}
