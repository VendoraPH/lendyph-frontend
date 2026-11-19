"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import {
  consentIsDraft,
  declaredExpenseRows,
  declaredIncomeRows,
  INCOME_SOURCE_LABELS,
  parseAmount,
  type WizardStepId,
} from "@/lib/loan-origination";
import type { ApplicationDocument, ApplicationDraft, ConsentAcceptance, PublicApplicationPortal } from "@/types/loan-origination";

type Consent = { privacy: boolean; terms: boolean; credit: boolean; declaration: boolean; marketing: boolean };

function Section({ title, step, onEdit, children }: { title: string; step: WizardStepId; onEdit: (s: WizardStepId) => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onEdit(step)}>
          Edit
        </Button>
      </div>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value || "—"}</dd>
    </>
  );
}

function ConsentBox({ id, label, text, checked, onChange }: { id: string; label: string; text?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="space-y-2">
      {text && (
        <details className="rounded-lg border bg-muted/30 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Read the {label.toLowerCase()}</summary>
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line text-muted-foreground">{text}</p>
        </details>
      )}
      <label htmlFor={id} className="flex items-start gap-2 text-sm">
        <input id={id} type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{label === "Marketing" ? "Send me news about other loans and services. (optional)" : `I have read and agree to the ${label.toLowerCase()}.`}</span>
      </label>
    </div>
  );
}

export function StepReview({
  draft,
  portal,
  documents,
  contact,
  submitting,
  problem,
  onEdit,
  onSubmit,
}: {
  draft: ApplicationDraft;
  portal: PublicApplicationPortal;
  documents: ApplicationDocument[];
  contact: { mobile: string; email: string };
  submitting: boolean;
  problem: string | null;
  onEdit: (step: WizardStepId) => void;
  onSubmit: (consent: ConsentAcceptance) => void;
}) {
  const [c, setC] = useState<Consent>({ privacy: false, terms: false, credit: false, declaration: false, marketing: false });
  const { personal: p, employment: e, expenses: x, loan: l } = draft;
  const product = portal.products.find((pr) => pr.id === l.loan_product_id);
  const ready = c.privacy && c.terms && c.declaration && (!portal.credit_authorization || c.credit);
  const set = (k: keyof Consent) => (v: boolean) => setC((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <Section title="Loan" step="loan" onEdit={onEdit}>
        <Row label="Product" value={product?.name} />
        <Row label="Amount" value={parseAmount(l.amount) !== null ? formatCurrency(parseAmount(l.amount)!) : null} />
        <Row label="Term" value={l.term && `${l.term} ${product?.term_unit ?? ""}`} />
        <Row label="Purpose" value={l.purpose} />
      </Section>
      <Section title="You" step="personal" onEdit={onEdit}>
        <Row label="Name" value={[p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(" ")} />
        <Row label="Date of birth" value={p.date_of_birth} />
        <Row label="Mobile" value={contact.mobile} />
        <Row label="Email" value={contact.email} />
        <Row label="Address" value={[p.street_address, p.barangay, p.city, p.province, p.postal_code].filter(Boolean).join(", ")} />
      </Section>
      <Section title="Income" step="employment" onEdit={onEdit}>
        <Row label="Source" value={e.income_source ? INCOME_SOURCE_LABELS[e.income_source] : null} />
        {declaredIncomeRows(e).map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </Section>
      <Section title="Expenses and debts" step="expenses" onEdit={onEdit}>
        <Row label="Existing loans" value={x.has_existing_loans === null ? null : x.has_existing_loans ? "Yes" : "None"} />
        {declaredExpenseRows(x).map(([label, value], i) => (
          <Row key={`${i}-${label}`} label={label} value={value} />
        ))}
      </Section>
      <Section title="Documents" step="documents" onEdit={onEdit}>
        {documents.filter((d) => d.file_name).length === 0 ? (
          <Row label="Files" value="None uploaded" />
        ) : (
          documents.filter((d) => d.file_name).map((d) => <Row key={d.id} label={d.label} value={d.file_name} />)
        )}
      </Section>

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Before you submit</h3>
        {consentIsDraft(portal) && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="note">
            Draft wording: these texts are placeholders until the cooperative approves its own.
          </p>
        )}
        <ConsentBox id="consent-privacy" label="Privacy notice" text={portal.privacy_notice.text} checked={c.privacy} onChange={set("privacy")} />
        <ConsentBox id="consent-terms" label="Terms" text={portal.terms.text} checked={c.terms} onChange={set("terms")} />
        {portal.credit_authorization && (
          <ConsentBox id="consent-credit" label="Credit check authorization" text={portal.credit_authorization.text} checked={c.credit} onChange={set("credit")} />
        )}
        <ConsentBox id="consent-declaration" label="Declaration" text={portal.declaration.text} checked={c.declaration} onChange={set("declaration")} />
        <ConsentBox id="consent-marketing" label="Marketing" checked={c.marketing} onChange={set("marketing")} />
      </section>

      {problem && (
        <p className="text-sm text-destructive" role="alert">
          {problem}
        </p>
      )}
      <Button
        size="lg"
        className="w-full sm:w-auto"
        disabled={!ready || submitting}
        onClick={() =>
          onSubmit({
            privacy_notice_version: portal.privacy_notice.version,
            terms_version: portal.terms.version,
            declaration_version: portal.declaration.version,
            credit_authorization_version: portal.credit_authorization?.version ?? null,
            marketing_opt_in: c.marketing,
          })
        }
      >
        {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Submit application
      </Button>
      {!ready && <p className="text-xs text-muted-foreground">Tick each agreement above to submit.</p>}
    </div>
  );
}
