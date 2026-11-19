/**
 * AMLA screening and orders shapes, as lendyph-backend's
 * `AmlaScreeningPresenter` sends them (Phase 6, AMLA-B5). Keys come with their
 * words; hold amounts are two-decimal strings.
 */
import type { AmlaUserRef } from "./amla";

export type AmlaWatchlistSource = "un" | "amlc" | "internal";

export interface AmlaWatchlistVersion {
  id: number;
  source: AmlaWatchlistSource | string;
  source_words: string;
  version_label: string | null;
  entry_count: number;
  status: "active" | "superseded" | string;
  status_words: string;
  rescreen_pending: boolean;
  rescreened_at: string | null;
  uploaded_by: AmlaUserRef | null;
  uploaded_at: string;
  superseded_at: string | null;
}

export interface AmlaWatchlist {
  source: AmlaWatchlistSource;
  source_words: string;
  format: "xml" | "csv";
  active_version: AmlaWatchlistVersion | null;
  versions: AmlaWatchlistVersion[];
}

export interface AmlaScreeningSubject {
  type: "member" | "walk_in" | "co_maker" | string;
  type_words: string;
  id: number;
  name: string | null;
  code: string | null;
}

export interface AmlaWatchlistEntry {
  id: number;
  source: string;
  source_words: string;
  reference: string;
  kind: string;
  kind_words: string;
  full_name: string;
  aliases?: string[];
  birth_years?: string[];
  nationalities?: string[];
}

export interface AmlaScreeningMatch {
  id: number;
  status: "pending" | "confirmed" | "cleared" | string;
  status_words: string;
  score: number;
  threshold: number;
  subject: AmlaScreeningSubject;
  entry: AmlaWatchlistEntry;
  found_at: string;
}

export interface AmlaScreeningMatchDetail extends AmlaScreeningMatch {
  reasons: string[];
  version: { id: number; label: string | null };
  decided_by: AmlaUserRef | null;
  decided_at: string | null;
  decision_reason: string | null;
}

export interface AmlaOrderHold {
  savings_hold_id: number;
  account_id: number;
  account_number: string | null;
  amount: string;
  status: string | null;
  status_words: string | null;
}

export interface AmlaOrder {
  id: number;
  reference: string;
  authority: "amlc" | "court" | "other" | string;
  authority_words: string;
  received_on: string;
  return_due_on: string | null;
  status: "active" | "released" | string;
  status_words: string;
  member: { id: number; name: string; code: string | null } | null;
  holds: AmlaOrderHold[];
  placed_by: AmlaUserRef | null;
  placed_at: string;
}

export interface AmlaPendingRelease {
  id: number;
  requested_by: AmlaUserRef | null;
  requested_at: string;
  reason: string;
  release_reference: string;
}

export interface AmlaOrderDetail extends AmlaOrder {
  required_action: string;
  details: string | null;
  responsible_officer: AmlaUserRef | null;
  pending_release: AmlaPendingRelease | null;
  release_requested_by: AmlaUserRef | null;
  released_by: AmlaUserRef | null;
  released_at: string | null;
  release_reason: string | null;
  release_reference: string | null;
}

export interface AmlaOrderBody {
  reference: string;
  authority: string;
  received_on: string;
  borrower_id: number;
  required_action: string;
  details?: string;
  return_due_on?: string;
  holds: { account_id: number; amount: string }[];
}

/** `GET /amla/cdd/{type}/{id}/valid-ids`: each ID once, by type and last four only. */
export interface AmlaMaskedId {
  document_id: number | null;
  id_type: string;
  id_type_words: string;
  id_number_masked: string | null;
}
