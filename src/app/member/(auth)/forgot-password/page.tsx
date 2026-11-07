"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { notifyValidation } from "@/lib/notify";
import { portalAuthMessage } from "@/lib/portal/auth-errors";
import { passwordProblem } from "@/lib/portal/password-rules";
import { portalService } from "@/services/portal.service";
import type { ActivationChallenge, PortalLoginIdentifier } from "@/types/portal";
import { AuthLink, AuthShell } from "../../_components/auth-shell";
import { IdentifierField } from "../../_components/identifier-field";
import { NewPasswordFields } from "../../_components/new-password-fields";
import { OtpStep } from "../../_components/otp-step";
import { usePortalConfig } from "../../_components/portal-config";

type Step = "identify" | "otp" | "password";

export default function MemberForgotPasswordPage() {
  const router = useRouter();
  const { config } = usePortalConfig();
  const [step, setStep] = useState<Step>("identify");
  const [busy, setBusy] = useState(false);
  const [chosenType, setChosenType] = useState<PortalLoginIdentifier | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [challenge, setChallenge] = useState<ActivationChallenge | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const type =
    chosenType && config.login_identifiers.includes(chosenType) ? chosenType : config.login_identifiers[0];

  const requestCode = () => {
    if (!identifier.trim()) return notifyValidation(["Your sign-in details"]);
    setBusy(true);
    portalService
      .forgotPassword({ identifier_type: type, identifier: identifier.trim() })
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
      .verifyResetOtp({ challenge_id: challenge.challenge_id, otp })
      .then(() => setStep("password"))
      .catch((err) => toast.error(portalAuthMessage(err, "otp")))
      .finally(() => setBusy(false));
  };

  const reset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    const problem = passwordProblem(password, confirmation, config.password_rules);
    if (problem) return toast.error(problem);
    setBusy(true);
    portalService
      .resetPassword({ challenge_id: challenge.challenge_id, password, password_confirmation: confirmation })
      .then(() => {
        toast.success("Password changed. Sign in with your new password.");
        router.replace("/member/login");
      })
      .catch((err) => {
        toast.error(portalAuthMessage(err, "password"));
        setBusy(false);
      });
  };

  return (
    <AuthShell
      title="Reset your password"
      description={step === "identify" ? "We will send a code to your registered mobile number or email." : undefined}
      footer={<AuthLink href="/member/login">Back to sign in</AuthLink>}
    >
      {step === "identify" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            requestCode();
          }}
        >
          <IdentifierField
            allowed={config.login_identifiers}
            type={type}
            value={identifier}
            onType={setChosenType}
            onValue={setIdentifier}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send code
          </Button>
        </form>
      )}
      {step === "otp" && challenge && (
        <OtpStep sentTo={challenge.sent_to} busy={busy} onSubmit={confirmOtp} onResend={requestCode} />
      )}
      {step === "password" && (
        <form className="space-y-5" onSubmit={reset}>
          <NewPasswordFields
            rules={config.password_rules}
            password={password}
            confirmation={confirmation}
            onPassword={setPassword}
            onConfirmation={setConfirmation}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
