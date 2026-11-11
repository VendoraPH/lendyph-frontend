"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { todayISO } from "@/lib/format";
import { portalErrorMessage } from "@/lib/portal/errors";
import { portalService } from "@/lib/portal/portal-api";
import type { CodeVerifyResponse } from "@/lib/portal/types";

/** Step 1: the member number, the code on the branch's slip and the birthdate. */
export function CheckStep({ notice, onVerified }: { notice: string | null; onVerified: (step: CodeVerifyResponse, memberNumber: string) => void }) {
  const { submitting, run } = useSubmitGuard();
  const [memberNumber, setMemberNumber] = useState("");
  const [code, setCode] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState<string | null>(notice);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!memberNumber.trim() || !code.trim() || !birthdate) {
      setError("Enter your member number, the code from your branch and your birthdate.");
      return;
    }
    setError(null);
    run(() => portalService.verifyCode(memberNumber.trim(), code.trim(), birthdate))
      ?.then((step) => onVerified(step, memberNumber.trim()))
      .catch((err: unknown) => setError(portalErrorMessage(err, "We couldn't check that code. Please try again.")));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="code-member">Member number</Label>
        <Input
          id="code-member"
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          value={memberNumber}
          onChange={(e) => setMemberNumber(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="code-value">Code from your branch</Label>
        <Input
          id="code-value"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX"
          maxLength={40}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-describedby="code-help"
        />
        <p id="code-help" className="text-xs text-muted-foreground">
          The 12 characters on the slip. Dashes and spaces don&apos;t matter.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="code-birthdate">Your birthdate</Label>
        <Input id="code-birthdate" type="date" max={todayISO()} value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
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
