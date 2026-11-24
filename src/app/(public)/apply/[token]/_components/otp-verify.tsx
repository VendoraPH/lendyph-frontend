"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicApplicationService } from "@/services/public-application.service";
import type { ApplicantSession, CodeSent, OtpPurpose, PublicNotice } from "@/types/public-application";
import { fieldErrors, publicErrorMessage } from "../_lib/errors";
import { cleanCode, isOtpCode, otpNotice } from "../_lib/otp";
import { TextField } from "./form-field";
import { NoticeText } from "./notice-text";

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

type Errors = { mobile?: string; code?: string; privacy?: string };

const ACCEPT_PRIVACY = "Read and accept the privacy notice to continue.";

/**
 * Texts a one-time code to the applicant's mobile and exchanges it for a
 * session. A new application first acknowledges the privacy notice, and its
 * version goes with the code (LO-B2 records it before anything is stored).
 */
export function OtpVerify({
  token,
  purpose,
  referenceNumber,
  privacyNotice,
  initialMobile = "",
  onVerified,
}: {
  token: string;
  purpose: OtpPurpose;
  referenceNumber?: string;
  /** A new application's privacy notice, acknowledged before its code. */
  privacyNotice?: PublicNotice | null;
  initialMobile?: string;
  onVerified: (session: ApplicantSession, mobile: string) => void;
}) {
  const [mobile, setMobile] = useState(initialMobile);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const wait = useCountdown(resendAt);
  const asksPrivacy = purpose === "apply" && privacyNotice != null;
  const notice = sent ? otpNotice(sent) : null;

  const target = () => ({ mobile: mobile.trim(), purpose, ...(referenceNumber ? { reference_number: referenceNumber } : {}) });

  /** The server's field refusals where they belong; anything else as one line. */
  const refused = (err: unknown, fallback: string) => {
    const fields = fieldErrors(err);
    const found: Errors = {
      mobile: fields?.mobile,
      code: fields?.code,
      privacy: fields?.privacy_notice_version,
    };
    setErrors(found);
    const other = fields ? Object.entries(fields).find(([key]) => !["mobile", "code", "privacy_notice_version"].includes(key))?.[1] : null;
    setProblem(fields ? (other ?? null) : publicErrorMessage(err, fallback));
  };

  const checked = (): boolean => {
    const found: Errors = {};
    if (!mobile.trim()) found.mobile = "Enter your mobile number.";
    if (asksPrivacy && !accepted) found.privacy = ACCEPT_PRIVACY;
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const send = () => {
    if (!checked()) return;
    setBusy(true);
    setProblem(null);
    publicApplicationService
      .requestCode(token, target())
      .then((result) => {
        setSent(result);
        setResendAt(Date.now() + result.resend_after * 1000);
        setCode("");
      })
      .catch((err) => refused(err, "We could not send a code. Please try again."))
      .then(() => setBusy(false));
  };

  const verify = () => {
    if (!checked()) return;
    const typed = cleanCode(code);
    if (!isOtpCode(typed)) {
      setErrors({ code: "Enter the 6-digit code." });
      return;
    }
    setBusy(true);
    setProblem(null);
    publicApplicationService
      .verifyCode(token, target(), typed, asksPrivacy ? privacyNotice?.version : undefined)
      .then((session) => {
        setBusy(false);
        onVerified(session, mobile.trim());
      })
      .catch((err) => {
        refused(err, "That code did not work. Check it and try again.");
        setBusy(false);
      });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`otp-mobile-${purpose}`}
          label="Mobile number"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0917 123 4567"
          hint="A Philippine mobile number. We text a code to it."
          value={mobile}
          error={errors.mobile}
          readOnly={sent !== null}
          onChange={setMobile}
        />
      </div>
      {asksPrivacy && privacyNotice && (
        <div className="space-y-2">
          <NoticeText label="Privacy notice" notice={privacyNotice} />
          <label htmlFor="otp-privacy" className="flex items-start gap-2 text-sm">
            <input id="otp-privacy" type="checkbox" className="mt-0.5" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>I have read the privacy notice and agree to it.</span>
          </label>
          {errors.privacy && (
            <p className="text-xs text-destructive" role="alert">
              {errors.privacy}
            </p>
          )}
        </div>
      )}
      {sent && notice && (
        <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
          <p className="text-sm" aria-live="polite">
            {notice.text}
          </p>
          {notice.testCode && (
            <p className="w-fit rounded-md border border-amber-300 bg-amber-50 px-3 py-1 font-mono text-lg tracking-widest text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              {notice.testCode}
            </p>
          )}
          <TextField
            id={`otp-code-${purpose}`}
            label="Code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
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
            <Button
              variant="link"
              className="px-0"
              disabled={busy}
              onClick={() => {
                setSent(null);
                setResendAt(null);
                setCode("");
                setErrors({});
                setProblem(null);
              }}
            >
              Change number
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
