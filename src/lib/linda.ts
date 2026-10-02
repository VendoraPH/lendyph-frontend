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

export const LINDA_SUGGESTED_QUESTIONS = [
  "How much have we collected this month?",
  "Which borrowers currently have overdue payments?",
  "How many active loans do we have?",
  "How much have we disbursed this month?",
  "Give me a summary of our lending operation this month.",
] as const;

export const LINDA_MESSAGES = {
  loading: "Linda is checking your lending data...",
  empty: "I couldn't find any records matching your request.",
  aiUnavailable: "Linda is currently unable to process your request. Please try again.",
  dataUnavailable: "I couldn't retrieve the lending data right now. Please try again.",
  forbidden: "Your role doesn't have access to Linda. Please ask your administrator.",
  notSetUp: "Linda isn't available on this account yet.",
  rateLimited: "You're sending questions a little fast. Please wait a moment and try again.",
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
 * `LINDA_HISTORY_LIMIT`, without failed answers (they carry no data the
 * backend should build on) or the user questions those failures answered.
 */
export function buildLindaHistory(
  messages: readonly LindaMessage[],
  limit = LINDA_HISTORY_LIMIT,
): LindaHistoryTurn[] {
  const turns: LindaHistoryTurn[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.failed) continue;
    if (m.role === "user" && messages[i + 1]?.failed) continue;
    turns.push(
      m.role === "assistant" && m.reply
        ? { role: "assistant", content: m.content, intent: m.reply.intent }
        : { role: m.role, content: m.content },
    );
  }
  return limit > 0 ? turns.slice(-limit) : [];
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

/**
 * An in-app path, or nothing. Links come from a model-assisted response, so
 * anything that could leave the app (`https://…`, `//host`, `javascript:`) is
 * dropped rather than rendered.
 */
export function safeLindaPath(v: unknown): string | undefined {
  const s = str(v)?.trim();
  if (!s || !s.startsWith("/") || s.startsWith("//") || s.includes("\\")) return undefined;
  return s;
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
    answer: answer ?? LINDA_MESSAGES.empty,
    blocks,
    links,
    as_of: str(raw.as_of),
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
  return LINDA_MESSAGES.aiUnavailable;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/**
 * A field's value as display text. Numbers arrive raw from the backend and are
 * formatted here, so "₱245,600" is spelled the same in every answer.
 */
export function formatLindaValue(field: LindaField): string {
  const { value, format, currency } = field;
  if (value === null || value === "") return "—";
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
      return Number.isFinite(n) ? n.toLocaleString("en-PH") : String(value);
    case "percent":
      return Number.isFinite(n)
        ? `${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}%`
        : String(value);
    case "date": {
      const s = String(value);
      return Number.isNaN(new Date(s).getTime()) ? s : formatDateLong(s);
    }
    default:
      return String(value);
  }
}
