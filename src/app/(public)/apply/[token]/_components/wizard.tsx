"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { mergeDraft, WIZARD_STEPS, type WizardErrors, type WizardStepId } from "@/lib/loan-origination";
import { publicApplicationService } from "@/services/public-application.service";
import type { ApplicationDraft } from "@/types/loan-origination";
import type { ApplicantSession, Consents, PublicApplicationState, PublicDocument, PublicPortal, Submitted } from "@/types/public-application";
import { useDraftAutosave } from "../_hooks/use-draft-autosave";
import { useLoanEstimate } from "../_hooks/use-loan-estimate";
import { fieldErrors, publicErrorMessage, sessionProblem } from "../_lib/errors";
import { uploadRules } from "../_lib/uploads";
import { draftAfterVerify, estimateRequest, missingDocumentsMessage, resumeStepIndex, stepErrors } from "../_lib/wizard-state";
import { OtpVerify } from "./otp-verify";
import { StepDocuments } from "./step-documents";
import { StepEmployment } from "./step-employment";
import { StepExpenses } from "./step-expenses";
import { StepLoan } from "./step-loan";
import { StepPersonal } from "./step-personal";
import { StepProduct } from "./step-product";
import { StepReview } from "./step-review";
import { WizardHeader } from "./wizard-header";

/** A removed file's row until the server's list comes back: the type, with no file. */
const withoutFile = (d: PublicDocument): PublicDocument => ({
  ...d,
  id: null,
  status: "not_submitted",
  file_name: null,
  mime_type: null,
  size_bytes: null,
  uploaded_at: null,
});

/** What ends the wizard, for the page to show next. */
export interface WizardExits {
  /** Submitted, or found already submitted (the reference, when the server gave it again). */
  onDone: (result: Submitted | null, already: boolean) => void;
  /** The session ended (idle, too old or replaced): a new code continues. */
  onSessionEnded: (message: string, mobile: string) => void;
  /** The link stopped taking applications. */
  onLinkClosed: () => void;
  onSignedOut: () => void;
}

/**
 * The eight-step application. The server is the authority on every step:
 * Next saves the draft and moves on only when the server's `missing_fields`
 * hold nothing for the step, the estimate and the monthly figures are the
 * server's, and the server works out the completion and the last step.
 */
export function Wizard({
  token,
  portal,
  initialSession,
  initialMobile,
  onDone,
  onSessionEnded,
  onLinkClosed,
  onSignedOut,
}: {
  token: string;
  portal: PublicPortal;
  initialSession: ApplicantSession | null;
  initialMobile: string;
} & WizardExits) {
  const [session, setSession] = useState(initialSession);
  const [mobile, setMobile] = useState(initialMobile);
  const [application, setApplication] = useState<PublicApplicationState | null>(initialSession?.application ?? null);
  const [draft, setDraft] = useState<ApplicationDraft>(() => mergeDraft(initialSession?.application?.draft));
  const [index, setIndex] = useState(() => (initialSession ? resumeStepIndex(initialSession.application?.last_completed_step ?? null) : 0));
  const [errors, setErrors] = useState<WizardErrors>({});
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<Record<string, string> | null>(null);
  const consentsSent = useRef<Consents | null>(null);
  const finished = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const step = WIZARD_STEPS[index];
  const sessionToken = session?.session_token ?? null;
  const product = portal.products.find((p) => p.id === draft.loan.loan_product_id);
  const rules = uploadRules(portal);

  /** The submit already went through: a retried submit answers the same reference. */
  const recoverSubmitted = () => {
    const consents = consentsSent.current;
    if (!sessionToken || !consents) return onDone(null, true);
    publicApplicationService.submit(token, sessionToken, consents).then(
      (result) => onDone(result, true),
      () => onDone(null, true),
    );
  };

  /** A session refusal ends the wizard, once; true when `err` was one. */
  const handleSessionError = (err: unknown): boolean => {
    const kind = sessionProblem(err);
    if (!kind) return false;
    if (finished.current) return true;
    finished.current = true;
    if (kind === "ended") onSessionEnded(publicErrorMessage(err, ""), mobile);
    else if (kind === "closed") {
      if (sessionToken) void publicApplicationService.logout(token, sessionToken);
      onLinkClosed();
    } else recoverSubmitted();
    return true;
  };

  const autosave = useDraftAutosave({
    token,
    sessionToken,
    draft,
    onSaved: setApplication,
    onFailed: (err) => void handleSessionError(err),
  });
  const estimate = useLoanEstimate(token, sessionToken, estimateRequest(draft.loan, product), handleSessionError);

  const patch =
    <K extends keyof ApplicationDraft>(key: K) =>
    (p: Partial<ApplicationDraft[K]>) =>
      setDraft((d) => ({ ...d, [key]: { ...d[key], ...p } }));

  const go = (to: number) => {
    setErrors({});
    setProblem(null);
    setRefusals(null);
    setIndex(to);
    bodyRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  };
  /** Moves on and saves in the background; a refusal there reaches the save status or ends the session. */
  const leave = (to: number) => {
    autosave.flush().catch(() => undefined);
    go(to);
  };
  const goTo = (id: WizardStepId) => leave(WIZARD_STEPS.findIndex((s) => s.id === id));

  /** The server's view again, after a file changed. */
  const refresh = () => {
    if (!sessionToken) return;
    publicApplicationService.getDraft(token, sessionToken).then(setApplication, (err) => void handleSessionError(err));
  };

  const next = () => {
    setProblem(null);
    if (step.id === "product") {
      if (draft.loan.loan_product_id === null) return setErrors({ loan_product_id: "Choose a loan product." });
      return leave(index + 1);
    }
    if (step.id === "documents") {
      const missing = missingDocumentsMessage(application?.documents ?? []);
      if (missing) return setErrors({ documents: missing });
      return leave(index + 1);
    }
    setChecking(true);
    autosave.flush().then(
      (saved) => {
        setChecking(false);
        const found = stepErrors(step.id, (saved ?? application)?.missing_fields ?? {});
        if (Object.keys(found).length > 0) return setErrors(found);
        go(index + 1);
      },
      (err) => {
        setChecking(false);
        if (handleSessionError(err)) return;
        const fields = fieldErrors(err);
        const found = fields ? stepErrors(step.id, fields) : {};
        if (Object.keys(found).length > 0) return setErrors(found);
        setProblem(fields ? Object.values(fields)[0] : publicErrorMessage(err, "Your answers couldn't be saved. Check your connection and try again."));
      },
    );
  };

  const verified = (started: ApplicantSession, typedMobile: string) => {
    const merged = draftAfterVerify(draft, started.application?.draft, portal.branches);
    setSession(started);
    setMobile(typedMobile);
    setApplication(started.application);
    setDraft(merged);
    go(resumeStepIndex(started.application?.last_completed_step ?? null));
  };

  const submit = (consents: Consents) => {
    if (!sessionToken) return;
    consentsSent.current = consents;
    setSubmitting(true);
    setProblem(null);
    setRefusals(null);
    autosave
      .flush()
      .then(() => publicApplicationService.submit(token, sessionToken, consents))
      .then((result) => {
        finished.current = true;
        // The session's work is done: it could only repeat the submit.
        void publicApplicationService.logout(token, sessionToken);
        onDone(result, false);
      })
      .catch((err) => {
        setSubmitting(false);
        if (handleSessionError(err)) return;
        const fields = fieldErrors(err);
        if (fields) setRefusals(fields);
        else setProblem(publicErrorMessage(err, "Your application couldn't be submitted. Your answers are saved; try again."));
      });
  };

  /** Saves what it can, ends the session, and always signs out in the browser. */
  const signOut = () => {
    if (!sessionToken) return onSignedOut();
    setLeaving(true);
    finished.current = true;
    autosave
      .flush()
      .catch(() => undefined)
      .then(() => publicApplicationService.logout(token, sessionToken))
      .then(onSignedOut);
  };

  const onDocumentChanged = (documents: PublicDocument[]) => {
    setApplication((current) => (current ? { ...current, documents } : current));
    refresh();
  };

  const body = () => {
    switch (step.id) {
      case "product":
        return (
          <StepProduct
            products={portal.products}
            value={draft.loan.loan_product_id}
            error={errors.loan_product_id}
            onChange={(id) => {
              const chosen = portal.products.find((p) => p.id === id);
              patch("loan")({ loan_product_id: id, frequency: chosen?.payment_frequencies.length === 1 ? chosen.payment_frequencies[0] : "" });
            }}
          />
        );
      case "contact":
        return session ? (
          <p className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-500/10 dark:text-green-300">
            <Check className="h-4 w-4" /> Verified: {application?.verified_contact.mobile ?? mobile}
          </p>
        ) : (
          <OtpVerify token={token} purpose="apply" privacyNotice={portal.privacy_notice} initialMobile={mobile} onVerified={verified} />
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
        return sessionToken && application ? (
          <StepDocuments
            documents={application.documents}
            descriptions={Object.fromEntries(portal.documents.map((d) => [d.type, d.description]))}
            rules={rules}
            error={errors.documents}
            row={{
              token,
              sessionToken,
              canRemove: true,
              onUploaded: (doc) => onDocumentChanged(application.documents.map((d) => (d.type === doc.type ? doc : d))),
              onRemoved: (type) => onDocumentChanged(application.documents.map((d) => (d.type === type ? withoutFile(d) : d))),
              onFailed: handleSessionError,
            }}
          />
        ) : null;
      case "review":
        return (
          <StepReview
            draft={draft}
            portal={portal}
            application={application}
            product={product}
            submitting={submitting}
            problem={problem}
            refusals={refusals}
            onEdit={goTo}
            onSubmit={submit}
          />
        );
    }
  };

  return (
    <div className="flex flex-col gap-4 fit:h-full fit:min-h-0">
      <WizardHeader
        index={index}
        total={WIZARD_STEPS.length}
        title={step.title}
        completion={application?.completion_percent ?? null}
        saveState={sessionToken ? autosave.state : null}
        leaving={leaving}
        onSignOut={sessionToken ? signOut : null}
        messages={step.id === "product" || step.id === "documents" ? [] : Object.values(errors)}
        problem={step.id === "review" ? null : problem}
      />

      <ScrollBox ref={bodyRef} className="rounded-xl border bg-card p-4 sm:p-6">
        {body()}
      </ScrollBox>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => leave(index - 1)} disabled={index === 0 || checking || submitting}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        {step.id !== "review" && (step.id !== "contact" || session) && (
          <Button onClick={next} disabled={checking}>
            {checking && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Next <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
