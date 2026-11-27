/**
 * Linda, the AI lending assistant: the `POST /linda/chat` contract.
 *
 * Lendy calculates, Linda explains. Every figure in `blocks` comes from the
 * backend's reports, and the server writes `answer` from its own templates;
 * the AI model only reads the question to pick the intent. The frontend
 * formats the figures itself (peso, dates, percents) so a value is spelled the
 * same in every answer.
 */

/** How the panel should render a value. */
export type LindaValueFormat = "currency" | "number" | "percent" | "date" | "text";

export interface LindaField {
  label: string;
  value: number | string | null;
  format?: LindaValueFormat;
  /** ISO 4217 code for `currency` values. Defaults to PHP. */
  currency?: string;
}

/** A row of headline figures, e.g. total collected + number of payments. */
export interface LindaStatsBlock {
  type: "stats";
  title?: string;
  items: LindaField[];
}

/** A ranked or plain list of records, e.g. top overdue borrowers. */
export interface LindaListItem {
  title: string;
  subtitle?: string;
  fields: LindaField[];
  /** In-app path to the record, e.g. "/borrowers/42". */
  url?: string;
}

export interface LindaListBlock {
  type: "list";
  title?: string;
  ordered?: boolean;
  items: LindaListItem[];
}

export type LindaBlock = LindaStatsBlock | LindaListBlock;

export interface LindaLink {
  label: string;
  /** In-app path only, e.g. "/loans/152" or "/reports". */
  url: string;
}

/** Intents the backend may answer with. Others are allowed and treated alike. */
export type LindaIntent =
  | "collection_summary"
  | "collection_details"
  | "loan_summary"
  | "loan_details"
  | "borrower_lookup"
  | "borrower_summary"
  | "overdue_accounts"
  | "disbursement_summary"
  | "transaction_lookup"
  | "income_summary"
  | "expense_summary"
  | "branch_performance"
  | "officer_performance"
  | "collection_efficiency"
  | "portfolio_summary"
  | "general_lending_summary"
  | "unsupported_question"
  | (string & {});

export interface LindaReply {
  intent: LindaIntent;
  answer: string;
  blocks: LindaBlock[];
  links: LindaLink[];
  /** When the figures were read, ISO 8601. */
  as_of?: string;
}

/** One earlier turn of the open session, sent back for follow-up questions. */
export interface LindaHistoryTurn {
  role: "user" | "assistant";
  content: string;
  intent?: LindaIntent;
}

export interface LindaChatRequest {
  message: string;
  history: LindaHistoryTurn[];
}

// ---------------------------------------------------------------------------
// Settings → Linda: `GET` and `PUT /linda/settings` (linda:settings and
// branches:view_all). Every figure is the server's; money is a 2-decimal
// string in pesos.
// ---------------------------------------------------------------------------

/** One model the server offers, with its prices in pesos. */
export interface LindaModelOption {
  id: string;
  label: string;
  description: string;
  /** ₱ per million input tokens. Null when the server's prices aren't set correctly. */
  input_per_million: string | null;
  /** ₱ per million output tokens. Null when the server's prices aren't set correctly. */
  output_per_million: string | null;
  /** ₱ for a typical question, as the server works it out. Null when its prices aren't set correctly. */
  per_question: string | null;
}

/** Why the AI model is off on this server. Others may come later and read as off. */
export type LindaAiOffReason =
  | "linda_off"
  | "model_off"
  | "test_driver"
  | "no_key"
  | "no_prices"
  | (string & {});

export interface LindaAiStatus {
  on: boolean;
  /** Null when on. */
  reason: LindaAiOffReason | null;
}

/** This Manila calendar month's AI use, from the question log. */
export interface LindaMonth {
  /** "November 2026". */
  label: string;
  cost: string;
  /** Null when the server's cap isn't set correctly. */
  cap: string | null;
  questions: number;
  /** Questions that went to the AI model. */
  model_questions: number;
}

export interface LindaSettings {
  /** The model Linda uses now. */
  model: string;
  models: LindaModelOption[];
  ai: LindaAiStatus;
  month: LindaMonth;
  /** Null until someone saves a choice. */
  updated_at: string | null;
  updated_by: string | null;
}

export interface LindaSettingsInput {
  model: string;
}
