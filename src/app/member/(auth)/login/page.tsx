"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";
import { notifyValidation } from "@/lib/notify";
import { portalAuthMessage } from "@/lib/portal/auth-errors";
import { usePortalSession } from "@/lib/portal/portal-session";
import { portalService } from "@/services/portal.service";
import type { PortalLoginIdentifier } from "@/types/portal";
import { AuthLink, AuthShell } from "../../_components/auth-shell";
import { IdentifierField } from "../../_components/identifier-field";
import { usePortalConfig } from "../../_components/portal-config";

export default function MemberLoginPage() {
  const router = useRouter();
  const { config } = usePortalConfig();
  const signIn = usePortalSession((s) => s.signIn);
  const [chosenType, setChosenType] = useState<PortalLoginIdentifier | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // The cooperative may have turned the member's last choice off since.
  const type =
    chosenType && config.login_identifiers.includes(chosenType) ? chosenType : config.login_identifiers[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const missing = [!identifier.trim() && "Your sign-in details", !password && "Password"].filter(
      Boolean,
    ) as string[];
    if (missing.length) return notifyValidation(missing);

    setBusy(true);
    portalService
      .login({ identifier_type: type, identifier: identifier.trim(), password })
      .then(({ token, expires_in, member }) => {
        signIn(token, expires_in, member);
        router.replace("/member");
      })
      .catch((err) => {
        toast.error(portalAuthMessage(err, "login"));
        setBusy(false);
      });
  };

  return (
    <AuthShell
      title="Sign in"
      description={config.welcome_message ?? "View your membership, loans, savings and share capital."}
      footer={
        <>
          First time here? <AuthLink href="/member/activate">Activate your account</AuthLink>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <IdentifierField
          allowed={config.login_identifiers}
          type={type}
          value={identifier}
          onType={setChosenType}
          onValue={setIdentifier}
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <AuthLink href="/member/forgot-password">Forgot password?</AuthLink>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
