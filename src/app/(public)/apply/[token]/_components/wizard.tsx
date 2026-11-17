"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CloudOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/format";
import {
  mergeDraft,
  validateEmployment,
  validateExpenses,
  validateLoanRequest,
  validatePersonal,
  WIZARD_STEPS,
  type WizardErrors,
  type WizardStepId,
} from "@/lib/loan-origination";
import { publicApplicationService, publicErrorMessage } from "@/services/public-application.service";
import type { ApplicationDocument, ApplicationDraft, ApplicationSession, PublicApplicationPortal, SubmitResult } from "@/types/loan-origination";
import { useDraftAutosave, type SaveState } from "../_hooks/use-draft-autosave";
import { useLoanEstimate } from "../_hooks/use-loan-estimate";
import { OtpVerify, type VerifiedContact } from "./otp-verify";
import { requiredDocumentsMet, StepDocuments } from "./step-documents";
import { StepEmployment } from "./step-employment";
import { StepExpenses } from "./step-expenses";
import { StepLoan } from "./step-loan";
import { StepPersonal } from "./step-personal";
import { StepProduct } from "./step-product";
import { StepReview } from "./step-review";

const SAVE_LABELS: Record<SaveState, string> = { idle: "", saving: "Saving…", saved: "Saved", error: "Not saved yet" };

/** Where a resumed application picks up: the step after the last one finished. */
function resumeIndex(session: ApplicationSession | null): number {
  const last = session?.application?.last_completed_step;
  const i = WIZARD_STEPS.findIndex((s) => s.id === last);
  return session ? Math.min(Math.max(i + 1, 2), WIZARD_STEPS.length - 1) : 0;
}

export function Wizard({
  token,
  portal,
  initialSession,
  initialContact,
  onDone,
}: {
  token: string;
  portal: PublicApplicationPortal;
  initialSession: ApplicationSession | null;
  initialContact: VerifiedContact | null;
  onDone: (result: SubmitResult) => void;
}) {
  const [session, setSession] = useState(initialSession);
  const [contact, setContact] = useState(initialContact);
  const [draft, setDraft] = useState<ApplicationDraft>(() => mergeDraft(initialSession?.application?.draft));
  const [documents, setDocuments] = useState<ApplicationDocument[]>(initialSession?.application?.documents ?? []);
  const [index, setIndex] = useState(() => resumeIndex(initialSession));
  const [errors, setErrors] = useState<WizardErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const step = WIZARD_STEPS[index];
  const sessionToken = session?.session_token ?? null;
  const product = portal.products.find((p) => p.id === draft.loan.loan_product_id);
  const autosave = useDraftAutosave(token, sessionToken, draft, step.id);
  const loanErrors = validateLoanRequest(draft.loan, product);
  const estimate = useLoanEstimate(token, sessionToken, draft.loan, !loanErrors.amount && !loanErrors.term && !loanErrors.frequency && !!product);

  const patch = <K extends keyof ApplicationDraft>(key: K) => (p: Partial<ApplicationDraft[K]>) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...p } }));

  const go = (to: number) => {
    void autosave.flush();
    setErrors({});
    setProblem(null);
    setIndex(to);
    window.scrollTo({ top: 0 });
  };
  const goTo = (id: WizardStepId) => go(WIZARD_STEPS.findIndex((s) => s.id === id));

  const check = (id: WizardStepId): WizardErrors => {
    switch (id) {
      case "product":
        return draft.loan.loan_product_id === null ? { loan_product_id: "Choose a loan product." } : {};
      case "personal":
        return validatePersonal(draft.personal, todayISO());
      case "employment":
        return validateEmployment(draft.employment);
      case "expenses":
        return validateExpenses(draft.expenses);
      case "loan":
        return loanErrors;
      case "documents":
        return requiredDocumentsMet(portal.documents, documents) ? {} : { documents: "Upload each required document." };
      default:
        return {};
    }
  };

  const next = () => {
    const found = check(step.id);
    setErrors(found);
    if (Object.keys(found).length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    go(index + 1);
  };

  const submit = (consent: Parameters<typeof publicApplicationService.submit>[2]) => {
    if (!sessionToken) return;
    setSubmitting(true);
    setProblem(null);
    autosave
      .flush()
      .then(() => publicApplicationService.submit(token, sessionToken, consent))
      .then(onDone)
      .catch((err) => {
        setProblem(publicErrorMessage(err, "We could not submit your application. Your answers are saved; try again."));
        setSubmitting(false);
      });
  };

  const selectProduct = (id: number) => {
    const p = portal.products.find((pr) => pr.id === id);
    patch("loan")({ loan_product_id: id, frequency: p?.payment_frequencies.length === 1 ? p.payment_frequencies[0] : "" });
  };

  const body = () => {
    switch (step.id) {
      case "product":
        return <StepProduct products={portal.products} value={draft.loan.loan_product_id} error={errors.loan_product_id} onChange={selectProduct} />;
      case "contact":
        return session && contact ? (
          <p className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <Check className="h-4 w-4" /> Verified: {contact.mobile}
            {contact.email && ` · ${contact.email}`}
          </p>
        ) : (
          <OtpVerify
            token={token}
            purpose="apply"
            channels={portal.otp_channels}
            onVerified={(s, c) => {
              setSession(s);
              setContact(c);
              if (s.application?.documents) setDocuments(s.application.documents);
              go(index + 1);
            }}
          />
        );
      case "personal":
        return <StepPersonal value={draft.personal} errors={errors} onChange={patch("personal")} branches={portal.branches} />;
      case "employment":
        return <StepEmployment value={draft.employment} errors={errors} onChange={patch("employment")} />;
      case "expenses":
        return <StepExpenses value={draft.expenses} errors={errors} onChange={patch("expenses")} />;
      case "loan":
        return <StepLoan value={draft.loan} errors={errors} onChange={patch("loan")} product={product} estimate={estimate} />;
      case "documents":
        return sessionToken ? (
          <StepDocuments
            requirements={portal.documents}
            documents={documents}
            accept={portal.accepted_file_types}
            maxMb={portal.max_upload_mb}
            token={token}
            sessionToken={sessionToken}
            error={errors.documents}
            onChange={setDocuments}
          />
        ) : null;
      case "review":
        return (
          <StepReview
            draft={draft}
            portal={portal}
            documents={documents}
            contact={contact ?? { mobile: "", email: "" }}
            submitting={submitting}
            problem={problem}
            onEdit={goTo}
            onSubmit={submit}
          />
        );
    }
  };

  const hasErrors = Object.keys(errors).length > 0;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Step {index + 1} of {WIZARD_STEPS.length}
          </span>
          {sessionToken && autosave.state !== "idle" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
              {autosave.state === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
              {autosave.state === "error" && <CloudOff className="h-3 w-3" />}
              {SAVE_LABELS[autosave.state]}
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full bg-brand-orange transition-[width]" style={{ width: `${((index + 1) / WIZARD_STEPS.length) * 100}%` }} />
        </div>
        <h1 className="text-xl font-semibold">{step.title}</h1>
      </div>

      {hasErrors && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          Check the fields marked below.
        </p>
      )}

      <div className="rounded-xl border bg-white p-4 sm:p-6">{body()}</div>

      {step.id !== "review" && (
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {(step.id !== "contact" || session) && (
            <Button onClick={next}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      {step.id === "review" && (
        <Button variant="outline" onClick={() => go(index - 1)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
      )}
    </div>
  );
}
