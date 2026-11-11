"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard } from "@/components/portal/auth-card";
import { PasswordFields } from "@/components/portal/password-fields";
import { usePasswordRules } from "@/components/portal/portal-config";
import { TermsConsent } from "@/components/portal/terms-consent";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { fieldErrorsOf, portalErrorMessage } from "@/lib/portal/errors";
import { passwordReady } from "@/lib/portal/password-rules";
import { portalService, type CompleteCodeBody } from "@/lib/portal/portal-api";
import { usePortalSession } from "@/lib/portal/portal-session";
import { CONFIRMS, confirmed } from "@/lib/portal/server-confirm";
import type { CodeVerifyResponse } from "@/lib/portal/types";
import { CheckStep } from "./_components/check-step";
import { OtpStep } from "./_components/otp-step";

type Phase = "check" | "otp" | "password" | "terms";

/**
 * "I have a code from my branch" (portal design §1): one flow for a first
 * activation and a password reset. Member number, code and birthdate, then
 * the one-time password when the cooperative turned it on, then a password,
 * then (activation only) the terms and the optional consent. Carried over
 * from #511 by Augustin, where activation and "forgot password" were two flows.
 */
export default function CodePage() {
  const router = useRouter();
  const rules = usePasswordRules();
  const signIn = usePortalSession((s) => s.signIn);
  const { submitting, run } = useSubmitGuard();
  const [phase, setPhase] = useState<Phase>("check");
  const [step, setStep] = useState<CodeVerifyResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [accepted, setAccepted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activation = step?.kind === "activation";

  const restart = (message: string) => {
    setStep(null);
    setPassword("");
    setConfirmation("");
    setNotice(message);
    setPhase("check");
  };

  const onVerified = (verified: CodeVerifyResponse) => {
    setStep(verified);
    setNotice(null);
    setPhase(verified.otp_required ? "otp" : "password");
  };

  const finish = (termsVersion?: string) => {
    if (!step) return;
    const body: CompleteCodeBody = { step_token: step.step_token, password, password_confirmation: confirmation };
    if (activation) {
      body.accepted_terms_version = termsVersion;
      body.ecomm_consent = consent;
    }
    setError(null);
    run(() => portalService.completeCode(body))
      ?.then((result) => {
        const login = confirmed(result, CONFIRMS.done);
        signIn(login.token, login.expires_in, login.member, login.idle_minutes, login.terms_required);
        router.replace(login.terms_required ? "/member/terms" : "/member");
      })
      .catch((err: unknown) => {
        const fields = fieldErrorsOf(err);
        const message = portalErrorMessage(err, "We couldn't finish. Please try again.");
        if (fields.step_token) restart(message);
        else if (fields.password) {
          setPasswordError(fields.password);
          setPhase("password");
        } else setError(message);
      });
  };

  const onPasswordContinue = (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordReady(password, confirmation, rules)) {
      setPasswordError("Choose a password that meets every rule, and type it the same way twice.");
      return;
    }
    setPasswordError(undefined);
    if (activation) setPhase("terms");
    else finish();
  };

  const title = phase === "check" ? "I have a code from my branch" : `Hello, ${step?.first_name ?? "member"}`;
  const description =
    phase === "check"
      ? "Your branch gives you a code to start using the portal, or to set a new password."
      : phase === "terms"
        ? "One last step: please read the terms."
        : activation
          ? "Choose the password you'll sign in with."
          : "Choose your new password. Your other devices will be signed out.";

  return (
    <AuthCard
      title={title}
      description={description}
      footer={
        <Link href="/member/login" className="underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {phase === "check" && <CheckStep notice={notice} onVerified={onVerified} />}
      {phase === "otp" && step && (
        <OtpStep stepToken={step.step_token} sentTo={step.sent_to} onVerified={() => setPhase("password")} onExpired={restart} />
      )}
      {phase === "password" && (
        <form onSubmit={onPasswordContinue} className="space-y-4" noValidate>
          <PasswordFields
            idPrefix="code"
            password={password}
            confirmation={confirmation}
            onPassword={setPassword}
            onConfirmation={setConfirmation}
            rules={rules}
            error={passwordError}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="h-10 w-full" disabled={submitting}>
            {submitting && <Spinner className="h-4 w-4" />}
            {activation ? "Continue" : "Set password and sign in"}
          </Button>
        </form>
      )}
      {phase === "terms" && (
        <TermsConsent accepted={accepted} onAccepted={setAccepted} consent={consent} onConsent={setConsent}>
          {(terms) => (
            <div className="space-y-3">
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button className="h-10 w-full" disabled={!accepted || submitting} onClick={() => finish(terms.version)}>
                {submitting && <Spinner className="h-4 w-4" />}
                Accept and sign in
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setPhase("password")} disabled={submitting}>
                Back
              </Button>
            </div>
          )}
        </TermsConsent>
      )}
    </AuthCard>
  );
}
