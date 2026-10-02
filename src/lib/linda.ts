/**
 * Pure helpers for Linda, the AI lending assistant. No React, no network, so
 * the rules that keep the panel honest are unit-tested.
 */

import { formatCurrencyExact, formatDateLong } from "@/lib/format";
import type {
  LindaBlock,
  LindaField,
  LindaHistoryTurn,
  LindaLink,
  LindaListItem,
  LindaReply,
  LindaValueFormat,
} from "@/types/linda";

/** Longest question the composer accepts. */
export const LINDA_MAX_MESSAGE_LENGTH = 500;

/**
 * How many earlier messages go back with a question. Enough for "How about
 * last month?" to resolve, small enough to keep the request lean.
 */
export const LINDA_HISTORY_LIMIT = 10;

/**
 * Longest answer text sent back in history. A follow-up needs the gist, not
 * a whole long answer, and this keeps a runaway reply from growing every
 * request after it.
 */
export const LINDA_HISTORY_CONTENT_LIMIT = 2000;

/** Longest link kept from a reply. No in-app page needs more. */
export const LINDA_MAX_LINK_LENGTH = 2048;

export const LINDA_SUGGESTED_QUESTIONS = [
  "How much have we collected this month?",
  "Which borrowers currently have overdue payments?",
  "How many active loans do we have?",
  "How much have we disbursed this month?",
  "Give me a summary of our lending operation this month.",
] as const;

export const LINDA_MESSAGES = {
  loading: "Linda is checking your lending data...",
  /** Stands in for a missing `answer` above figures the server did send. */
  figuresOnly: "Here's what I found.",
  aiUnavailable: "Linda is currently unable to process your request. Please try again.",
  dataUnavailable: "I couldn't retrieve the lending data right now. Please try again.",
  forbidden: "Your role doesn't have access to Linda. Please ask your administrator.",
  notSetUp: "Linda isn't available on this account yet.",
  rateLimited: "You're sending questions a little fast. Please wait a moment and try again.",
  invalidQuestion: "Linda can't take that question as written. Please rephrase it.",
  noHistory:
    "Linda does not save your chat history. Please take note of any important information before closing this chat.",
} as const;

/** A message in the open panel. Lives in component state only, never stored. */
export interface LindaMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  reply?: LindaReply;
  /** An assistant message that stands in for a failed request. */
  failed?: boolean;
}

/**
 * The earlier turns sent with a new question: the most recent
 * `LINDA_HISTORY_LIMIT`, as question-and-answer pairs. A question goes back
 * only with the answer Linda gave it, so a failed answer (it carries no data
 * the backend should build on) and a question whose request ended silently
 * (cancelled, 401, 423) are both left out. The server therefore always gets
 * alternating turns that start with a question, even after trimming.
 */
export function buildLindaHistory(
  messages: readonly LindaMessage[],
  limit = LINDA_HISTORY_LIMIT,
): LindaHistoryTurn[] {
  const pairs: [LindaHistoryTurn, LindaHistoryTurn][] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const question = messages[i];
    const answer = messages[i + 1];
    if (question.role !== "user" || answer.role !== "assistant" || !answer.reply) continue;
    pairs.push([
      { role: "user", content: question.content },
      {
        role: "assistant",
        content: truncate(answer.content, LINDA_HISTORY_CONTENT_LIMIT),
        intent: answer.reply.intent,
      },
    ]);
  }
  const keep = Math.floor(limit / 2);
  return keep > 0 ? pairs.slice(-keep).flat() : [];
}

/**
 * `s` cut to at most `max` UTF-16 units, never through a surrogate pair: a
 * lone surrogate is not valid JSON text to many servers (PHP rejects it).
 */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/**
 * True while an input method (Japanese, Chinese, Korean…) is composing, when
 * Enter confirms a candidate and Escape cancels it. Safari ends composition
 * before the keydown, so its 229 key code is checked as well.
 */
export function isImeComposing(e: { isComposing: boolean; keyCode: number }): boolean {
  return e.isComposing || e.keyCode === 229;
}

// ---------------------------------------------------------------------------
// Reply normalisation
// ---------------------------------------------------------------------------

const FORMATS: readonly LindaValueFormat[] = ["currency", "number", "percent", "date", "text"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

/** Control characters, which browsers strip from a URL, and the backslash, which they read as "/". */
const URL_TRICK_CHARS = /[\u0000-\u001F\u007F\\]/;

/** The API proxy and API routes: requests, not pages a link should open. */
const API_PATH = /^\/api(\/|$)/i;

/** `%XX` escapes decoded byte by byte. Lenient on purpose: never throws. */
function percentDecode(s: string): string {
  return s.replace(/%([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function appOrigin(): string {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

/**
 * An in-app path, or nothing. Links come from a model-assisted response, so
 * anything that could leave the app is dropped rather than rendered.
 *
 * Checking the raw string is not enough: browsers strip tabs and newlines
 * before following a URL ("/\t/evil.com" opens evil.com), and dot segments
 * resolve away ("/.//evil.com" becomes the path "//evil.com", which is a link
 * to that host). So the candidate is resolved against the app's origin, must
 * stay on it, and only its path, query and hash are kept, with the path
 * checked again (also percent-decoded) for anything that reads as a host.
 * API paths and overlong links are dropped too: neither is a page.
 */
export function safeLindaPath(v: unknown, origin: string = appOrigin()): string | undefined {
  const s = str(v)?.trim();
  if (!s || s.length > LINDA_MAX_LINK_LENGTH) return undefined;
  if (!s.startsWith("/") || URL_TRICK_CHARS.test(s)) return undefined;
  let url: URL;
  try {
    url = new URL(s, origin);
    if (url.origin !== new URL(origin).origin) return undefined;
  } catch {
    return undefined;
  }
  const path = percentDecode(url.pathname);
  if (path.startsWith("//") || URL_TRICK_CHARS.test(path) || API_PATH.test(path)) return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** An ISO 8601 timestamp the panel can format, or nothing. */
function validDate(v: unknown): string | undefined {
  const s = str(v);
  return s && !Number.isNaN(Date.parse(s)) ? s : undefined;
}

function normalizeField(v: unknown): LindaField | null {
  if (!isRecord(v)) return null;
  const label = str(v.label);
  if (!label) return null;
  const value =
    typeof v.value === "number" || typeof v.value === "string" ? v.value : null;
  const format = FORMATS.includes(v.format as LindaValueFormat)
    ? (v.format as LindaValueFormat)
    : undefined;
  return { label, value, format, currency: str(v.currency) };
}

function fields(v: unknown): LindaField[] {
  return Array.isArray(v)
    ? v.map(normalizeField).filter((f): f is LindaField => f !== null)
    : [];
}

function normalizeListItem(v: unknown): LindaListItem | null {
  if (!isRecord(v)) return null;
  const title = str(v.title);
  if (!title) return null;
  return { title, subtitle: str(v.subtitle), fields: fields(v.fields), url: safeLindaPath(v.url) };
}

function normalizeBlock(v: unknown): LindaBlock | null {
  if (!isRecord(v)) return null;
  const title = str(v.title);
  if (v.type === "stats") {
    const items = fields(v.items);
    return items.length ? { type: "stats", title, items } : null;
  }
  if (v.type === "list") {
    const items = Array.isArray(v.items)
      ? v.items.map(normalizeListItem).filter((i): i is LindaListItem => i !== null)
      : [];
    return items.length ? { type: "list", title, ordered: v.ordered === true, items } : null;
  }
  return null;
}

function normalizeLink(v: unknown): LindaLink | null {
  if (!isRecord(v)) return null;
  const label = str(v.label);
  const url = safeLindaPath(v.url);
  return label && url ? { label, url } : null;
}

/**
 * The reply as the panel can safely render it, or `null` when the body is not
 * a Linda reply at all. Unknown block types, malformed rows and off-site links
 * are dropped one by one so a single bad entry does not cost the whole answer.
 */
export function normalizeLindaReply(raw: unknown): LindaReply | null {
  if (!isRecord(raw)) return null;
  const answer = str(raw.answer);
  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks.map(normalizeBlock).filter((b): b is LindaBlock => b !== null)
    : [];
  if (!answer && blocks.length === 0) return null;
  const links = Array.isArray(raw.links)
    ? raw.links.map(normalizeLink).filter((l): l is LindaLink => l !== null)
    : [];
  return {
    intent: str(raw.intent) ?? "unknown",
    answer: answer ?? LINDA_MESSAGES.figuresOnly,
    blocks,
    links,
    as_of: validDate(raw.as_of),
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * What the panel says when a request fails. Never the server's own message:
 * that can carry SQL, paths or stack traces, and the spec forbids showing any
 * of it. `null` means stay silent (the request was cancelled, or the session
 * interceptor is already handling a 401/423).
 */
export function lindaErrorMessage(
  status: number | undefined,
  errorCode?: string,
  canceled = false,
): string | null {
  if (canceled || status === 401 || status === 423) return null;
  if (errorCode === "data_unavailable") return LINDA_MESSAGES.dataUnavailable;
  if (status === 403) return LINDA_MESSAGES.forbidden;
  if (status === 404 || status === 501) return LINDA_MESSAGES.notSetUp;
  if (status === 429) return LINDA_MESSAGES.rateLimited;
  // The server refused the question itself; sending it again changes nothing.
  if (status === 400 || status === 422) return LINDA_MESSAGES.invalidQuestion;
  return LINDA_MESSAGES.aiUnavailable;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/**
 * Every digit the server sent, grouped. Rates and figures are never rounded
 * for display (a 2.375% rate must not read 2.38%); a trailing zero carries no
 * value, so "2.3750" still reads 2.375, as `formatRate` shows rates.
 */
const exactNumber = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 20 });

/**
 * A field's value as display text. Numbers arrive raw from the backend and are
 * formatted here, so "₱245,600" is spelled the same in every answer. A blank
 * value is a dash: `Number(" ")` is 0, and "₱0" would be a figure nobody sent.
 */
export function formatLindaValue(field: LindaField): string {
  const { value, format, currency } = field;
  if (value === null || (typeof value === "string" && value.trim() === "")) return "—";
  const n = typeof value === "number" ? value : Number(value);
  switch (format) {
    case "currency":
      if (!Number.isFinite(n)) return String(value);
      if (currency && currency.toUpperCase() !== "PHP") {
        try {
          return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(n);
        } catch {
          return `${currency} ${n.toLocaleString("en-PH")}`;
        }
      }
      return formatCurrencyExact(n);
    case "number":
      return Number.isFinite(n) ? exactNumber.format(n) : String(value);
    case "percent":
      return Number.isFinite(n) ? `${exactNumber.format(n)}%` : String(value);
    case "date": {
      const s = String(value);
      return Number.isNaN(new Date(s).getTime()) ? s : formatDateLong(s);
    }
    default:
      return String(value);
  }
}
