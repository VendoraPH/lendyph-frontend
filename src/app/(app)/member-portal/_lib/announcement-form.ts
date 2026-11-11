import type {
  PortalAnnouncement,
  PortalAnnouncementAudience,
  PortalAnnouncementInput,
  PortalMemberType,
} from "@/types/portal-admin";
import { AUDIENCE_LABELS, MEMBER_TYPE_LABELS } from "./labels";

/**
 * The announcement form: a draft as the inputs hold it, what's missing, and
 * the body it sends. Times are typed in Philippine time
 * (`datetime-local`, no zone) and sent with the +08:00 offset, so they mean
 * the same on any computer.
 */

export interface AnnouncementDraft {
  title: string;
  body: string;
  audience: PortalAnnouncementAudience;
  branch_ids: number[];
  member_types: PortalMemberType[];
  /** "YYYY-MM-DDTHH:mm" in Philippine time, or "" for none. */
  publish_at: string;
  expires_at: string;
  pinned: boolean;
}

/** Audiences the caller may pick: company-wide ones need `branches:view_all`. */
export function audiencesFor(viewAll: boolean): PortalAnnouncementAudience[] {
  return viewAll ? ["all", "branch", "member_type"] : ["branch"];
}

const MANILA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** A server time as a `datetime-local` value in Philippine time ("" for none). */
export function toManilaInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(MANILA.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** A `datetime-local` value typed in Philippine time, with its offset; null for none. */
export function fromManilaInput(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+08:00` : null;
}

export function draftOf(a: PortalAnnouncement | null, viewAll: boolean): AnnouncementDraft {
  if (!a) {
    return {
      title: "",
      body: "",
      audience: viewAll ? "all" : "branch",
      branch_ids: [],
      member_types: [],
      publish_at: "",
      expires_at: "",
      pinned: false,
    };
  }
  return {
    title: a.title,
    body: a.body,
    audience: a.audience,
    branch_ids: [...a.branch_ids],
    member_types: [...a.member_types],
    publish_at: toManilaInput(a.publish_at),
    expires_at: toManilaInput(a.expires_at),
    pinned: a.pinned,
  };
}

/** What's still missing, in words (the server checks again). */
export function draftProblems(d: AnnouncementDraft, viewAll: boolean): string[] {
  const problems: string[] = [];
  if (d.title.trim() === "") problems.push("Give the announcement a title.");
  if (d.body.trim() === "") problems.push("Write the announcement.");
  if (!audiencesFor(viewAll).includes(d.audience)) {
    problems.push("Announcing to all members or a member type needs access to all branches. Choose your branches.");
  }
  if (d.audience === "branch" && d.branch_ids.length === 0) problems.push("Choose at least one branch.");
  if (d.audience === "member_type" && d.member_types.length === 0) problems.push("Choose at least one member type.");
  if (d.publish_at !== "" && d.expires_at !== "" && d.expires_at <= d.publish_at) {
    problems.push("The end must be after the start.");
  }
  return problems;
}

/** The body: only the audience's own list goes, and blank times go as null. */
export function draftBody(d: AnnouncementDraft): PortalAnnouncementInput {
  return {
    title: d.title.trim(),
    body: d.body.trim(),
    audience: d.audience,
    ...(d.audience === "branch" ? { branch_ids: d.branch_ids } : {}),
    ...(d.audience === "member_type" ? { member_types: d.member_types } : {}),
    publish_at: fromManilaInput(d.publish_at),
    expires_at: fromManilaInput(d.expires_at),
    pinned: d.pinned,
  };
}

/** Who sees it, in words: "Members of Main, North", "Regular members". */
export function audienceText(a: Pick<PortalAnnouncement, "audience" | "branches" | "member_types">): string {
  if (a.audience === "branch") {
    const names = a.branches.map((b) => b.name);
    return names.length > 0 ? `Members of ${names.join(", ")}` : AUDIENCE_LABELS.branch;
  }
  if (a.audience === "member_type") {
    const types = a.member_types.map((t) => (Object.hasOwn(MEMBER_TYPE_LABELS, t) ? MEMBER_TYPE_LABELS[t] : "Other members"));
    return types.length > 0 ? types.join(" and ") : AUDIENCE_LABELS.member_type;
  }
  return Object.hasOwn(AUDIENCE_LABELS, a.audience) ? AUDIENCE_LABELS[a.audience] : "Other";
}
