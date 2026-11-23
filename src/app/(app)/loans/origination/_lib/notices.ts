/**
 * The texts an applicant accepts (`/loan-origination/notices`, LO-B1): the
 * privacy notice, terms, declaration and credit authorization. Each version
 * is published once and never edited or removed; the newest of each type is
 * the current one. Links stay closed until the required ones are published.
 * The server checks everything again and refuses in its words; these only
 * spare a round trip.
 */

import type { NoticeType, OriginationNotice, PublishNoticeInput } from "@/types/loan-origination";

/** The types in the server's order, in its words (OriginationNotice::TYPES and TYPE_LABELS). */
export const NOTICE_TYPES: readonly { type: NoticeType; label: string }[] = [
  { type: "privacy_notice", label: "Privacy notice" },
  { type: "terms", label: "Terms and conditions" },
  { type: "declaration", label: "Declaration" },
  { type: "credit_authorization", label: "Credit authorization" },
];

/** OriginationAccess::NOTICE_REFUSAL. */
export const NOTICE_REFUSAL =
  "Online application notices apply to every branch, so publishing one needs the online applications settings permission and access to all branches.";

/** Why this user can't publish (the page already needs `loan_origination:settings`), or null. */
export function publishBlocker(viewAll: boolean): string | null {
  return viewAll ? null : NOTICE_REFUSAL;
}

export interface NoticeForm {
  type: NoticeType | "";
  version: string;
  title: string;
  body: string;
  final: boolean;
}

const VERSION = /^[0-9A-Za-z][0-9A-Za-z.-]*$/;
const MAX_VERSION = 20;
const MAX_BODY = 50000;

/**
 * `POST /loan-origination/notices`, and the first thing the server would
 * refuse, in its words (StoreOriginationNoticeRequest), or null. A blank
 * title is left out.
 */
export function noticePayload(form: NoticeForm): { payload: PublishNoticeInput; problem: string | null } {
  const version = form.version.trim();
  const title = form.title.trim();
  const payload: PublishNoticeInput = {
    type: form.type as NoticeType,
    version,
    ...(title ? { title } : {}),
    body: form.body,
    final: form.final,
  };
  let problem: string | null = null;
  if (form.type === "") problem = "Choose the privacy notice, terms and conditions, declaration or credit authorization.";
  else if (version === "") problem = "Give this text a version, like 2026.1.";
  else if (!VERSION.test(version)) problem = "A version uses letters, digits, dots and dashes, like 2026.1.";
  else if (version.length > MAX_VERSION) problem = "A version can be at most 20 characters, like 2026.1.";
  else if (form.body.trim() === "") problem = "Enter the text applicants will read.";
  else if (form.body.length > MAX_BODY) problem = "The text can be at most 50,000 characters.";
  return { payload, problem };
}

/** One type's versions, newest first as the server lists them. */
export function versionsOf(versions: readonly OriginationNotice[], type: NoticeType): OriginationNotice[] {
  return versions.filter((v) => v.type === type);
}
