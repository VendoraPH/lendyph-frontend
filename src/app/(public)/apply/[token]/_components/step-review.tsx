"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pesoOrDash } from "@/lib/credit-scoring/capacity";
import { formatCurrency } from "@/lib/format";
import { inWords, RELEASE_METHODS, type WizardStepId } from "@/lib/loan-origination";
import type { ApplicationDraft } from "@/types/loan-origination";
import type { Consents, DeclaredLine, NoticeKey, PublicApplicationState, PublicPortal, PublicProduct } from "@/types/public-application";
import { consentsFor, noticesAreDraft, noticesToAccept, scheduleWords } from "../_lib/portal-state";
import { expenseRows, incomeRows, personalRows, type ReviewRow } from "../_lib/review-rows";
import { missingDocumentsMessage, problemsByStep, typedAmount, type StepProblems } from "../_lib/wizard-state";
import { NoticeText } from "./notice-text";

const GRID = "grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]";

/** A section of answers, and under it the server's monthly figures when it has some. */
function Section({
  title,
  step,
  onEdit,
  children,
  figures,
}: {
  title: string;
  step: WizardStepId;
  onEdit: (s: WizardStepId) => void;
  children: React.ReactNode;
  figures?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onEdit(step)}>
          Edit
        </Button>
      </div>
      <dl className={GRID}>{children}</dl>
      {figures && (
        <>
          <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">Per month, worked out by the office from your answers</p>
          <dl className={GRID}>{figures}</dl>
        </>
      )}
    </section>
  );
}

function Row({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <>
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={strong ? "font-medium break-words tabular-nums" : "break-words tabular-nums"}>{value || "—"}</dd>
    </>
  );
}

/** Everything entered in a section, in words. */
function Answers({ rows }: { rows: ReviewRow[] }) {
  return (
    <>
      {rows.map((row, i) => (
        <Row key={`${i}-${row.label}`} label={row.label} value={row.value} />
      ))}
    </>
  );
}

/** The server's monthly lines, each as it sent it. */
function Lines({ lines }: { lines: DeclaredLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <Row key={line.key} label={line.label} value={formatCurrency(line.monthly)} />
      ))}
    </>
  );
}

/** What the server says still blocks a submit, by step, each with a way back to it. */
function Problems({ title, groups, onEdit }: { title: string; groups: StepProblems[]; onEdit: (s: WizardStepId) => void }) {
  return (
    <section className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
      <h3 className="text-sm font-semibold text-destructive">{title}</h3>
      {groups.map((group) => (
        <div key={group.step} className="space-y-1 text-sm">
          {group.step !== "review" ? (
            <Button type="button" variant="link" size="sm" className="h-auto p-0 font-medium" onClick={() => onEdit(group.step)}>
              {group.title}
            </Button>
          ) : (
            <p className="font-medium">{group.title}</p>
          )}
          <ul className="list-disc space-y-0.5 pl-5 text-destructive">
            {group.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * The last step: the answers as saved, the monthly figures the server worked
 * out from them (`declared_totals`), what the server says still blocks a
 * submit (`missing_fields` and the required documents), and every published
 * notice to accept.
 */
export function StepReview({
  draft,
  portal,
  application,
  product,
  incomeShown,
  submitting,
  problem,
  refusals,
  onEdit,
  onSubmit,
}: {
  draft: ApplicationDraft;
  portal: PublicPortal;
  application: PublicApplicationState | null;
  product: PublicProduct | undefined;
  /** The Income step's fields as it shows them (`visibleFields`). */
  incomeShown: ReadonlySet<string>;
  submitting: boolean;
  problem: string | null;
  /** A refused submit's fields, in the server's words. */
  refusals: Record<string, string> | null;
  onEdit: (step: WizardStepId) => void;
  onSubmit: (consents: Consents) => void;
}) {
  const [ticked, setTicked] = useState<Partial<Record<NoticeKey, boolean>>>({});
  const [marketing, setMarketing] = useState(false);
  const { personal: p, employment: e, expenses: x, loan: l } = draft;
  const totals = application?.declared_totals;
  const documentsMissing = application ? missingDocumentsMessage(application.documents) : null;
  const blocking = problemsByStep({ ...(application?.missing_fields ?? {}), ...(documentsMissing ? { documents: documentsMissing } : {}) });
  const notices = noticesToAccept(portal);
  const consents = consentsFor(portal, marketing);
  const allTicked = notices.every((n) => ticked[n.key]);
  const ready = consents !== null && allTicked && blocking.length === 0 && !submitting;
  const amount = typedAmount(l.amount);
  const schedule = l.frequency || (product?.payment_frequencies.length === 1 ? product.payment_frequencies[0] : "");

  return (
    <div className="space-y-4">
      {blocking.length > 0 && <Problems title="Before you can submit" groups={blocking} onEdit={onEdit} />}

      <Section title="Loan" step="loan" onEdit={onEdit}>
        <Row label="Product" value={product?.name} />
        <Row label="Amount" value={amount !== null ? formatCurrency(amount) : null} />
        <Row label="Term" value={l.term && `${l.term} ${product?.term_unit ?? ""}`} />
        <Row label="Payment schedule" value={schedule && scheduleWords(schedule)} />
        <Row label="Receive the money by" value={inWords(l.release_method, RELEASE_METHODS)} />
        <Row label="Purpose" value={l.purpose} />
      </Section>
      <Section title="You" step="personal" onEdit={onEdit}>
        <Answers rows={personalRows(p, portal.branches)} />
        <Row label="Mobile" value={application?.verified_contact.mobile} />
      </Section>
      <Section
        title="Income"
        step="employment"
        onEdit={onEdit}
        figures={
          <>
            {totals && <Lines lines={totals.income} />}
            <Row label="Monthly income" value={pesoOrDash(totals?.monthly_income)} strong />
          </>
        }
      >
        <Answers rows={incomeRows(e, incomeShown)} />
      </Section>
      <Section
        title="Expenses and debts"
        step="expenses"
        onEdit={onEdit}
        figures={
          <>
            <Row label="Monthly expenses" value={pesoOrDash(totals?.monthly_expenses)} strong />
            {totals && <Lines lines={totals.debts} />}
            <Row label="Monthly debt payments" value={pesoOrDash(totals?.monthly_debt_payments)} strong />
            <Row label="Left each month" value={pesoOrDash(totals?.monthly_remaining)} strong />
          </>
        }
      >
        <Answers rows={expenseRows(x)} />
      </Section>
      <Section title="Documents" step="documents" onEdit={onEdit}>
        {(application?.documents ?? []).filter((d) => d.file_name).length === 0 ? (
          <Row label="Files" value="None uploaded" />
        ) : (
          (application?.documents ?? []).filter((d) => d.file_name).map((d) => <Row key={d.type} label={d.label} value={d.file_name} />)
        )}
      </Section>

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Before you submit</h3>
        {noticesAreDraft(portal) && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" role="note">
            Draft wording: these texts are placeholders until the cooperative approves its own.
          </p>
        )}
        {notices.map(({ key, label, notice }) => (
          <div key={key} className="space-y-2">
            <NoticeText label={label} notice={notice} />
            <label htmlFor={`consent-${key}`} className="flex items-start gap-2 text-sm">
              <input
                id={`consent-${key}`}
                type="checkbox"
                className="mt-0.5"
                checked={ticked[key] ?? false}
                onChange={(event) => setTicked((prev) => ({ ...prev, [key]: event.target.checked }))}
              />
              <span>I have read and agree to the {label.toLowerCase()}.</span>
            </label>
          </div>
        ))}
        <label htmlFor="consent-marketing" className="flex items-start gap-2 text-sm">
          <input id="consent-marketing" type="checkbox" className="mt-0.5" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />
          <span>Send me news about other loans and services. (optional)</span>
        </label>
      </section>

      {refusals && <Problems title="Your application wasn't submitted" groups={problemsByStep(refusals)} onEdit={onEdit} />}
      {problem && (
        <p className="text-sm text-destructive" role="alert">
          {problem}
        </p>
      )}
      <div className="space-y-1">
        <Button size="lg" className="w-full sm:w-auto" disabled={!ready} onClick={() => consents && onSubmit(consents)}>
          {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Submit application
        </Button>
        {blocking.length === 0 && !allTicked && <p className="text-xs text-muted-foreground">Tick each agreement above to submit.</p>}
      </div>
    </div>
  );
}
