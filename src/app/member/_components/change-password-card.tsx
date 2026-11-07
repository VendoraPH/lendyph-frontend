"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { formatDate } from "@/lib/format";
import { httpStatusOf } from "@/lib/api-error";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { passwordProblem } from "@/lib/portal/password-rules";
import { usePortalSession } from "@/lib/portal/portal-session";
import { portalService } from "@/services/portal.service";
import { NewPasswordFields } from "./new-password-fields";
import { usePortalConfig } from "./portal-config";

const EMPTY = { current: "", password: "", confirmation: "" };

export function ChangePasswordCard() {
  const { config } = usePortalConfig();
  const changedAt = usePortalSession((s) => s.member?.password_changed_at ?? null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.current) return notifyValidation(["Current password"]);
    const problem = passwordProblem(form.password, form.confirmation, config.password_rules);
    if (problem) return toast.error(problem);
    if (form.password === form.current) return toast.error("Choose a password different from your current one.");
    setBusy(true);
    portalService
      .changePassword({
        current_password: form.current,
        password: form.password,
        password_confirmation: form.confirmation,
      })
      .then(() => {
        notifySuccess("Password changed", "Your other devices have been signed out.");
        setForm(EMPTY);
      })
      .catch((err) =>
        httpStatusOf(err) === 422
          ? notifyError(err, "Your current password is not correct.")
          : notifyError(err, "Your password could not be changed."),
      )
      .finally(() => setBusy(false));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
        {changedAt && <p className="text-xs text-muted-foreground">Last changed {formatDate(changedAt)}</p>}
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
            />
          </div>
          <NewPasswordFields
            rules={config.password_rules}
            password={form.password}
            confirmation={form.confirmation}
            onPassword={(password) => setForm({ ...form, password })}
            onConfirmation={(confirmation) => setForm({ ...form, confirmation })}
          />
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
