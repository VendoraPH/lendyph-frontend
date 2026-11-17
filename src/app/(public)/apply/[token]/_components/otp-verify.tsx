"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeMobile, validateContact, type WizardErrors } from "@/lib/loan-origination";
import {
  publicApplicationService,
  publicErrorMessage,
  type OtpPurpose,
  type OtpTarget,
} from "@/services/public-application.service";
import type { ApplicationSession, OtpRequestResult } from "@/types/loan-origination";
import { TextField } from "./form-field";

export interface VerifiedContact {
  mobile: string;
  email: string;
}

/** Seconds left until `until` (epoch ms), ticking once a second while above zero. */
function useCountdown(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
}

/**
 * Sends a one-time code to the applicant's mobile (or email, where the
 * organization allows it) and exchanges it for an application session.
 */
export function OtpVerify({
  token,
  purpose,
  channels,
  referenceNumber,
  initial,
  onVerified,
}: {
  token: string;
  purpose: OtpPurpose;
  channels: ("sms" | "email")[];
  referenceNumber?: string;
  initial?: VerifiedContact;
  onVerified: (session: ApplicationSession, contact: VerifiedContact) => void;
}) {
  const [contact, setContact] = useState<VerifiedContact>(initial ?? { mobile: "", email: "" });
  const [channel, setChannel] = useState<"sms" | "email">(channels[0] ?? "sms");
  const [errors, setErrors] = useState<WizardErrors>({});
  const [sent, setSent] = useState<OtpRequestResult | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const wait = useCountdown(resendAt);

  const target = (): OtpTarget => ({
    channel,
    mobile: normalizeMobile(contact.mobile),
    email: contact.email.trim() || undefined,
    purpose,
    reference_number: referenceNumber,
  });

  const send = () => {
    const found = validateContact(contact.mobile, contact.email);
    if (channel === "email" && !contact.email.trim()) found.email = "Enter the email address to send the code to.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    publicApplicationService
      .requestOtp(token, target())
      .then((r) => {
        setSent(r);
        setResendAt(Date.now() + r.resend_after * 1000);
        setCode("");
      })
      .catch((err) => setProblem(publicErrorMessage(err, "We could not send a code. Please try again.")))
      .then(() => setBusy(false));
  };

  const verify = () => {
    if (!/^\d{4,8}$/.test(code.trim())) {
      setErrors({ code: "Enter the code we sent you." });
      return;
    }
    setErrors({});
    setBusy(true);
    setProblem(null);
    publicApplicationService
      .verifyOtp(token, target(), code.trim())
      .then((session) => onVerified(session, contact))
      .catch((err) => setProblem(publicErrorMessage(err, "That code did not work. Check it and try again.")))
      .then(() => setBusy(false));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="otp-mobile"
          label="Mobile number"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="09171234567"
          value={contact.mobile}
          error={errors.mobile}
          onChange={(mobile) => setContact((c) => ({ ...c, mobile }))}
        />
        <TextField
          id="otp-email"
          label="Email"
          required={channel === "email"}
          type="email"
          autoComplete="email"
          value={contact.email}
          error={errors.email}
          onChange={(email) => setContact((c) => ({ ...c, email }))}
        />
      </div>
      {channels.length > 1 && !sent && (
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 text-sm font-medium">Send the code by</legend>
          {channels.map((c) => (
            <label key={c} className="flex items-center gap-2">
              <input type="radio" name="otp-channel" checked={channel === c} onChange={() => setChannel(c)} />
              {c === "sms" ? "Text message" : "Email"}
            </label>
          ))}
        </fieldset>
      )}
      {sent && (
        <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
          <p className="text-sm">
            We sent a code to <span className="font-medium">{sent.destination}</span>. It expires in{" "}
            {Math.round(sent.expires_in / 60)} minutes.
          </p>
          <TextField
            id="otp-code"
            label="Code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            error={errors.code}
            onChange={setCode}
          />
        </div>
      )}
      {problem && (
        <p className="text-sm text-destructive" role="alert">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {sent ? (
          <>
            <Button onClick={verify} disabled={busy}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Verify
            </Button>
            <Button variant="outline" onClick={send} disabled={busy || wait > 0}>
              {wait > 0 ? `Send again in ${wait}s` : "Send a new code"}
            </Button>
          </>
        ) : (
          <Button onClick={send} disabled={busy}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Send code
          </Button>
        )}
      </div>
    </div>
  );
}
