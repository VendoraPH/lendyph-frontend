"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard } from "@/components/portal/auth-card";
import { usePortalConfig } from "@/components/portal/portal-config";
import { useIsClient } from "@/hooks/use-is-client";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { portalErrorMessage } from "@/lib/portal/errors";
import { portalService } from "@/lib/portal/portal-api";
import { portalNotice } from "@/lib/portal/portal-client";
import { usePortalSession } from "@/lib/portal/portal-session";
import { CONFIRMS, confirmed } from "@/lib/portal/server-confirm";

/** Sign-in by member number and password (portal design §1; carried over from #511 by Augustin). */
export default function MemberLoginPage() {
  // The notice lives in this tab's sessionStorage, so the form renders in the browser only.
  return useIsClient() ? <LoginForm /> : null;
}

function LoginForm() {
  const router = useRouter();
  const { config, loaded } = usePortalConfig();
  const signIn = usePortalSession((s) => s.signIn);
  const { submitting, run } = useSubmitGuard();
  const [memberNumber, setMemberNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Why the last session ended (idle, turned off), said once.
  const [notice] = useState(() => portalNotice.read());
  const off = loaded && config !== null && !config.enabled;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!memberNumber.trim() || !password) {
      setError("Enter your member number and password.");
      return;
    }
    setError(null);
    run(() => portalService.login(memberNumber.trim(), password))
      ?.then((result) => {
        const body = confirmed(result, CONFIRMS.done);
        signIn(body.token, body.expires_in, body.member, body.idle_minutes, body.terms_required);
        router.replace(body.terms_required ? "/member/terms" : "/member");
      })
      .catch((err: unknown) => {
        setPassword("");
        setError(portalErrorMessage(err, "We couldn't sign you in. Please try again."));
      });
  };

  return (
    <AuthCard
      title="Sign in"
      description={config?.welcome_message || "Use your member number and your portal password."}
      footer={config?.support_contact ? <>Need help? {config.support_contact}</> : undefined}
    >
      {notice && (
        <Alert className="mb-4">
          <Info className="h-4 w-4" aria-hidden />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {off ? (
        <p role="status" className="text-sm text-muted-foreground">
          The member portal is not available right now. Please contact your branch.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="member-number">Member number</Label>
            <Input
              id="member-number"
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              value={memberNumber}
              onChange={(e) => setMemberNumber(e.target.value)}
              aria-invalid={!!error}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-password">Password</Label>
            <PasswordInput
              id="member-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
          {error && (
            <p id="login-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="h-10 w-full" disabled={submitting}>
            {submitting && <Spinner className="h-4 w-4" />}
            Sign in
          </Button>
          <p className="text-center text-sm">
            <Link href="/member/code" className="font-medium text-primary underline-offset-4 hover:underline">
              I have a code from my branch
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            First time here, or forgot your password? Ask your branch for a code, then use the link above.
          </p>
        </form>
      )}
    </AuthCard>
  );
}
