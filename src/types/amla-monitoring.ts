/**
 * AMLA monitoring shapes, as lendyph-backend's `AmlaDetectionPresenter` and
 * the risk-rules endpoint send them (Phase 6, AMLA-B3 and B4). Money arrives
 * already in words ("₱500,000.00"); a value Lendy doesn't hold reads
 * "Data not available".
 */
import type { AmlaUserRef } from "./amla";

export type AmlaAlertPriority = "low" | "medium" | "high" | "critical";

export interface AmlaMonitoringSubject {
  type: "member" | "walk_in" | null;
  id: number | null;
  name: string;
  code: string;
  account: string;
}

export interface AmlaMonitoringBranch {
  id: number | null;
  name: string;
}

export interface AmlaAlertRow {
  id: number;
  reference: string;
  rule_code: string;
  rule: string;
  rule_version: number;
  priority: AmlaAlertPriority | string;
  priority_words: string;
  status: "open" | "cleared" | string;
  status_words: string;
  subject: AmlaMonitoringSubject;
  branch: AmlaMonitoringBranch;
  window_start: string;
  window_end: string;
  /** The standing transactions' total, in words. */
  amount: string;
  transactions_count: number;
  from_history: boolean;
  /** Since the alert workflow (AMLA-B6): who works it, and the case it went to (head-office case holders only). */
  assigned_to?: AmlaUserRef | null;
  case?: { id: number; reference: string } | null;
  closed_at?: string | null;
  detected_at: string | null;
}

/** `GET /amla/alerts/{id}/history`: one workflow step, with its note or close reason. */
export interface AmlaAlertHistoryStep {
  id: number;
  action: string;
  action_words: string;
  from_status: string | null;
  to_status: string;
  to_status_words: string;
  by: AmlaUserRef | null;
  assignee: AmlaUserRef | null;
  case_id: number | null;
  note: string | null;
  at: string | null;
}

export interface AmlaIndicator {
  label: string;
  value: string;
}

export interface AmlaMonitoredTransaction {
  id: number;
  kind: string;
  kind_words: string;
  direction_words: string;
  internal: boolean;
  amount: string;
  occurred_on: string;
  channel: string;
  reference: string;
  branch: string;
  reversed: boolean;
  reversed_at: string | null;
}

export interface AmlaAlertDetail extends AmlaAlertRow {
  reason: string;
  indicators: AmlaIndicator[];
  cleared_at: string | null;
  cleared_note: string | null;
  transactions: AmlaMonitoredTransaction[];
}

export interface AmlaCtrRow {
  id: number;
  reference: string;
  status: string;
  status_words: string;
  amount: string;
  threshold: string;
  settings_version: number;
  direction_words: string;
  channel_words: string;
  subject: AmlaMonitoringSubject;
  branch: AmlaMonitoringBranch;
  occurred_on: string;
  from_history: boolean;
  event_reversed_at: string | null;
  detected_at: string | null;
}

export interface AmlaCtrDetail extends AmlaCtrRow {
  explanation: string;
  transaction: AmlaMonitoredTransaction | null;
}

/** A detection rule's parameters as stored: money as a two-decimal string, channels as a list, the rest whole numbers. */
export type AmlaRuleParams = Record<string, string | number | string[]>;

export interface AmlaDetectionRule {
  code: string;
  rule: string;
  description: string;
  active: boolean;
  priority: AmlaAlertPriority | string;
  priority_words: string;
  params: AmlaRuleParams;
  /** Each parameter with the server's own label and kind (AMLA-B7); older answers may lack it. */
  parameters?: AmlaRuleParameter[];
  /** "Available", or why the rule can't raise anything yet. */
  availability: string;
}

export interface AmlaRuleParameter {
  name: string;
  label: string;
  kind: "count" | "days" | "multiplier" | "percent" | "peso" | "channels" | string;
  value: string | number | string[] | null;
}

export interface AmlaDetectionRulesVersion {
  version: number;
  /** The version a change was asked from; null for the starting rules (AMLA-B7). */
  base_version?: number | null;
  /** The waiting detection rules change, if any (AMLA-B7). */
  pending_change_request_id?: number | null;
  to_verify: boolean;
  effective_at: string | null;
  note: string;
  rules: AmlaDetectionRule[];
}

export interface AmlaRiskRulesDefinition {
  factors: Record<string, Record<string, number>>;
  thresholds: { medium: number; high: number };
  high_risk_countries: string[];
}

export interface AmlaRiskRulesVersion {
  id: number;
  version: number;
  to_verify: boolean;
  definition: AmlaRiskRulesDefinition;
  effective_at: string | null;
  source: "system_default" | "approved_change";
  request_id: number | null;
  approved_by: AmlaUserRef | null;
}

export interface AmlaRiskRules {
  current: AmlaRiskRulesVersion;
  versions: AmlaRiskRulesVersion[];
  factor_words: Record<string, string>;
  value_words: Record<string, string>;
  pending_request_id: number | null;
}
