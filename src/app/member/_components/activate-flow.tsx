"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepIndicator } from "@/components/common/step-indicator";
import { notifyValidation } from "@/lib/notify";
import { portalAuthMessage } from "@/lib/portal/auth-errors";
import { passwordProblem } from "@/lib/portal/password-rules";
import { usePortalSession } from "@/lib/portal/portal-session";
import { portalService } from "@/services/portal.service";
import type { ActivationChallenge, ActivationVerifyRequest } from "@/types/portal";
import { AuthLink, AuthShell } from "./auth-shell";
import { NewPasswordFields } from "./new-password-fields";
import { OtpStep } from "./otp-step";
import { usePortalConfig } from "./portal-config";

type Step = "verify" | "otp" | "password";
const STEPS = ["Verify", "Code", "Password"];
/** StepIndicator counts from 1. */
const STEP_INDEX: Record<Step, number> = { verify: 1, otp: 2, password: 3 };

/**
 * Activation: prove who you are (an invitation link, or membership number +
 * registered mobile/email + birthdate), confirm a one-time code, then choose a
 * password and accept the terms. Ends signed in.
 */
export function ActivateFlow() {
  const router = useRouter();
  const invitation = useSearchParams().get("token");
  const { config } = usePortalConfig();
  const signIn = usePortalSession((s) => s.signIn);

  const [step, setStep] = useState<Step>("verify");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<ActivationChallenge | null>(null);
  const [details, setDetails] = useState({ member_number: "", contact: "", birthdate: "" });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [consent, setConsent] = useState(false);

  const verifyBody = (): ActivationVerifyRequest =>
    invitation
      ? { invitation_token: invitation }
      : {
          member_number: details.member_number.trim(),
          contact: details.contact.trim(),
          birthdate: details.birthdate,
        };

  const verify = () => {
    if (!invitation) {
      const missing = [
        !details.member_number.trim() && "Membership number",
        !details.contact.trim() && "Mobile number or email",
        !details.birthdate && "Birthdate",
      ].filter(Boolean) as string[];
      if (missing.length) return notifyValidation(missing);
    }
    setBusy(true);
    portalService
      .verifyActivation(verifyBody())
      .then((c) => {
        setChallenge(c);
        setStep("otp");
      })
      .catch((err) => toast.error(portalAuthMessage(err, "verify")))
      .finally(() => setBusy(false));
  };

  const confirmOtp = (otp: string) => {
    if (!challenge) return;
    setBusy(true);
    portalService
      .verifyActivationOtp({ challenge_id: challenge.challenge_id, otp })
      .then(() => setStep("password"))
      .catch((err) => toast.error(portalAuthMessage(err, "otp")))
      .finally(() => setBusy(false));
  };

  const complete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    const problem = passwordProblem(password, confirmation, config.password_rules);
    if (problem) return toast.error(problem);
    if (!acceptTerms) return toast.error("Please accept the terms of use to continue.");
    setBusy(true);
    portalService
      .completeActivation({
        challenge_id: challenge.challenge_id,
        password,
        password_confirmation: confirmation,
        accepted_terms_version: config.terms_version,
        electronic_communication_consent: consent,
      })
      .then(({ token, expires_in, member }) => {
        signIn(token, expires_in, member);
        toast.success(`Welcome, ${member.first_name}. Your account is ready.`);
        router.replace("/member");
      })
      .catch((err) => {
        toast.error(portalAuthMessage(err, "password"));
        setBusy(false);
      });
  };

  return (
    <AuthShell
      title={challenge ? `Hi ${challenge.member_first_name}, let's set up your account` : "Activate your account"}
      description={
        step === "verify"
          ? invitation
            ? "You were invited to the member portal. Continue to receive a verification code."
            : "Enter the details your cooperative has on file."
          : undefined
      }
      footer={
        <>
          Already activated? <AuthLink href="/member/login">Sign in</AuthLink>
        </>
      }
    >
      <StepIndicator labels={STEPS} current={STEP_INDEX[step]} />

      {step === "verify" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          {!invitation && (
            <>
              <Field id="member-number" label="Membership number">
                <Input
                  id="member-number"
                  value={details.member_number}
                  onChange={(e) => setDetails({ ...details, member_number: e.target.value })}
                />
              </Field>
              <Field id="contact" label="Registered mobile number or email">
                <Input
                  id="contact"
                  value={details.contact}
                  onChange={(e) => setDetails({ ...details, contact: e.target.value })}
                />
              </Field>
              <Field id="birthdate" label="Birthdate">
                <Input
                  id="birthdate"
                  type="date"
                  value={details.birthdate}
                  onChange={(e) => setDetails({ ...details, birthdate: e.target.value })}
                />
              </Field>
            </>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send verification code
          </Button>
        </form>
      )}

      {step === "otp" && challenge && (
        <OtpStep sentTo={challenge.sent_to} busy={busy} onSubmit={confirmOtp} onResend={verify} />
      )}

      {step === "password" && (
        <form className="space-y-5" onSubmit={complete}>
          <NewPasswordFields
            rules={config.password_rules}
            password={password}
            confirmation={confirmation}
            onPassword={setPassword}
            onConfirmation={setConfirmation}
          />
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} />
            <span>
              I accept the{" "}
              {config.terms_url ? (
                <a href={config.terms_url} target="_blank" rel="noreferrer" className="underline">
                  terms of use
                </a>
              ) : (
                "terms of use"
              )}{" "}
              and{" "}
              {config.privacy_url ? (
                <a href={config.privacy_url} target="_blank" rel="noreferrer" className="underline">
                  privacy notice
                </a>
              ) : (
                "privacy notice"
              )}
              .
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
            <span>Send me statements and notices electronically (optional).</span>
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Activate account
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
