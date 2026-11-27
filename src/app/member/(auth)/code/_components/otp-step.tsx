"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { fieldErrorsOf, portalErrorMessage } from "@/lib/portal/errors";
import { portalService } from "@/lib/portal/portal-api";

/** Step 2, only while the cooperative turned OTP on: the 6 digits sent to the member's mobile. */
export function OtpStep({
  stepToken,
  sentTo,
  onVerified,
  onExpired,
}: {
  stepToken: string;
  sentTo: string | null;
  onVerified: () => void;
  onExpired: (message: string) => void;
}) {
  const { submitting, run } = useSubmitGuard();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6 digits from the text message.");
      return;
    }
    setError(null);
    run(() => portalService.verifyOtp(stepToken, otp))
      ?.then(onVerified)
      .catch((err: unknown) => {
        const message = portalErrorMessage(err, "We couldn't check that code. Please try again.");
        if (fieldErrorsOf(err).step_token) onExpired(message);
        else setError(message);
      });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit code to {sentTo ?? "your registered mobile number"}. It works for 5 minutes.
      </p>
      <div className="space-y-2">
        <Label htmlFor="code-otp">One-time password</Label>
        <Input
          id="code-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-10 w-full" disabled={submitting}>
        {submitting && <Spinner className="h-4 w-4" />}
        Continue
      </Button>
    </form>
  );
}
