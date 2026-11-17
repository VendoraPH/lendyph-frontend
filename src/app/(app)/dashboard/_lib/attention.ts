/**
 * "Requires Attention": the conditions an executive should act on, read from
 * what the dashboard already loaded. A source that did not arrive raises
 * nothing: an alert is never inferred from a missing figure.
 */

import { formatCurrency } from "@/lib/format";
import { readyData, type ExecutiveData } from "./executive-data";
import { formatMetric, sumKnown, toNumber } from "./metrics";

export type AlertTone = "critical" | "warning";

export interface AttentionItem {
  id: string;
  tone: AlertTone;
  title: string;
  detail: string;
  href: string;
}

/** Thresholds, in percent. Kept here so the rule and its wording cannot drift apart. */
export const ATTENTION_THRESHOLDS = {
  parWarning: 5,
  parCritical: 10,
  collectionWarning: 90,
  collectionCritical: 80,
} as const;

const plural = (n: number, one: string, many = `${one}s`) => `${formatMetric(n, "count")} ${n === 1 ? one : many}`;

export function attentionItems(d: ExecutiveData): AttentionItem[] {
  const items: AttentionItem[] = [];
  const t = ATTENTION_THRESHOLDS;

  const accounting = readyData(d.accounting);
  if (accounting && accounting.is_balanced === false) {
    items.push({
      id: "books-unbalanced",
      tone: "critical",
      title: "The books do not balance",
      detail: "Total debits and credits differ. Accounting figures here are not reliable until this is fixed.",
      href: "/accounting/trial-balance",
    });
  }

  const balance = readyData(d.balance);
  const par = toNumber(balance?.par_ratio);
  if (par !== null && par >= t.parWarning) {
    items.push({
      id: "par",
      tone: par >= t.parCritical ? "critical" : "warning",
      title: `Portfolio at risk is ${par.toFixed(2)}%`,
      detail: `Above the ${par >= t.parCritical ? t.parCritical : t.parWarning}% threshold. ${formatCurrency(toNumber(balance?.at_risk_amount))} of principal is more than 30 days past due.`,
      href: "/loans/past-due",
    });
  }

  const efficiency = readyData(d.efficiency);
  const rate = toNumber(efficiency?.collection_rate);
  const due = toNumber(efficiency?.total_due);
  if (rate !== null && due !== null && due > 0 && rate < t.collectionWarning) {
    items.push({
      id: "collection",
      tone: rate < t.collectionCritical ? "critical" : "warning",
      title: `Collection efficiency is ${rate.toFixed(2)}%`,
      detail: `${formatCurrency(toNumber(efficiency?.uncollected))} of the amount due in the period is uncollected.`,
      href: "/reports/collection_efficiency",
    });
  }

  const aging = readyData(d.aging);
  const over90 = toNumber(aging?.buckets?.over_90?.amount);
  if (over90 !== null && over90 > 0) {
    const count = toNumber(aging?.buckets?.over_90?.count) ?? 0;
    items.push({
      id: "over-90",
      tone: "critical",
      title: "Accounts more than 90 days past due",
      detail: `${formatCurrency(over90)} across ${plural(count, "installment")}.`,
      href: "/reports/aging_report",
    });
  }

  const stats = readyData(d.loanStats);
  const forReview = toNumber(stats?.for_review) ?? 0;
  if (forReview > 0) {
    items.push({
      id: "for-review",
      tone: "warning",
      title: `${plural(forReview, "application")} waiting for approval`,
      detail: "Submitted loan applications that have not been approved or rejected yet.",
      href: "/loans",
    });
  }
  const approved = toNumber(stats?.approved) ?? toNumber(readyData(d.disbursements)?.pending_release) ?? 0;
  if (approved > 0) {
    items.push({
      id: "awaiting-release",
      tone: "warning",
      title: `${plural(approved, "approved loan")} not yet released`,
      detail: "Approved applications whose proceeds have not been released to the borrower.",
      href: "/loans",
    });
  }

  if (accounting && accounting.unposted_journals > 0) {
    items.push({
      id: "unposted",
      tone: "warning",
      title: `${plural(accounting.unposted_journals, "journal entry", "journal entries")} not posted`,
      detail: "Draft entries are left out of every balance until someone posts them.",
      href: "/accounting/journals",
    });
  }
  if (accounting?.adjustments_clearing_needs_review) {
    items.push({
      id: "clearing",
      tone: "warning",
      title: "Loan adjustments clearing is not zero",
      detail: "Account 1180 should be cleared after every adjustment. Review the open balance.",
      href: "/accounting/general-ledger",
    });
  }

  const pastDue = balance?.overdue ? sumKnown(balance.overdue.principal, balance.overdue.interest, balance.overdue.penalty) : null;
  const pastDueLoans = toNumber(balance?.overdue?.loan_count);
  if (pastDue !== null && pastDue > 0 && !items.some((i) => i.id === "par")) {
    items.push({
      id: "past-due",
      tone: "warning",
      title: "Loans with past due installments",
      detail: `${formatCurrency(pastDue)} past due${pastDueLoans !== null ? ` on ${plural(pastDueLoans, "loan")}` : ""}.`,
      href: "/loans/past-due",
    });
  }

  return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "critical" ? -1 : 1));
}
