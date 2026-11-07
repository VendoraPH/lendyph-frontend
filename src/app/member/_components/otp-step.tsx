"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const LENGTH = 6;

interface OtpStepProps {
  sentTo: string;
  busy: boolean;
  onSubmit: (otp: string) => void;
  onResend: () => void;
}

/** Enter the six-digit code sent to the member's mobile or email. */
export function OtpStep({ sentTo, busy, onSubmit, onResend }: OtpStepProps) {
  const [otp, setOtp] = useState("");
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (otp.length === LENGTH) onSubmit(otp);
      }}
    >
      <p className="text-sm text-muted-foreground">
        We sent a {LENGTH}-digit code to <span className="font-medium text-foreground">{sentTo}</span>.
      </p>
      <div className="flex justify-center">
        <InputOTP maxLength={LENGTH} value={otp} onChange={setOtp} autoFocus aria-label="Verification code">
          <InputOTPGroup>
            {Array.from({ length: LENGTH }, (_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button type="submit" className="w-full" disabled={busy || otp.length !== LENGTH}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Verify code
      </Button>
      <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={onResend}>
        Send a new code
      </Button>
    </form>
  );
}
