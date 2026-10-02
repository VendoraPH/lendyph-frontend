/**
 * Linda, the AI lending assistant: the `POST /linda/chat` contract.
 *
 * Lendy calculates, Linda explains. Every figure in `blocks` is computed by the
 * backend's data service; the model only writes `answer`. The frontend formats
 * the figures itself (peso, dates, percents) so a value never depends on how
 * the model chose to spell it.
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
  /** In-app path only, e.g. "/reports/overdue". */
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
