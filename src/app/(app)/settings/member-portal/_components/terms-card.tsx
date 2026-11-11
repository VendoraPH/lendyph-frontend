"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDateTime } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalTermsSummary } from "@/types/portal-admin";
import { FormField } from "@/app/(app)/savings/_components/field";
import { notifyPortalError } from "@/app/(app)/member-portal/_lib/notify-portal-error";
import { EMPTY_TERMS, termsBody, termsProblems, type TermsForm } from "../_lib/settings-form";

/**
 * The terms publisher. A version is published at once and never edited: a
 * change is a new version. With "Members must accept again", every member is
 * asked to accept it before they can use the portal again. The text is the
 * cooperative's own (ideally from its data protection officer).
 */
export function TermsCard({ current, onPublished }: { current: PortalTermsSummary | null; onPublished: () => void }) {
  const [form, setForm] = useState<TermsForm>(EMPTY_TERMS);
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  const problems = termsProblems(form);
  const set = <K extends keyof TermsForm>(key: K, value: TermsForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  function publish() {
    setSubmitted(true);
    if (problems.length > 0) return;
    run(() => portalAdminService.publishTerms(termsBody(form)))
      ?.then((published) => {
        notifySuccess(`Terms version ${published.version} published`);
        setForm(EMPTY_TERMS);
        setSubmitted(false);
        onPublished();
      })
      .catch((err: unknown) => notifyPortalError(err, "The terms couldn't be published."));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Terms of use and privacy notice</CardTitle>
        <CardDescription>
          {current
            ? `Current: version ${current.version}, "${current.title}"${current.published_at ? `, published ${formatDateTime(current.published_at)}` : ""}.`
            : "No terms are published yet. Members can't be invited, and the portal can't be turned on, until they are."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <FormField id="tc-version" label="Version" hint="For example 2026-11.">
            <Input id="tc-version" maxLength={20} value={form.version} onChange={(e) => set("version", e.target.value)} />
          </FormField>
          <FormField id="tc-title" label="Title">
            <Input id="tc-title" maxLength={150} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </FormField>
        </div>
        <FormField id="tc-terms" label="Terms of use">
          <Textarea id="tc-terms" rows={6} value={form.terms_body} onChange={(e) => set("terms_body", e.target.value)} />
        </FormField>
        <FormField id="tc-privacy" label="Privacy notice">
          <Textarea id="tc-privacy" rows={6} value={form.privacy_body} onChange={(e) => set("privacy_body", e.target.value)} />
        </FormField>
        <FormField id="tc-consent" label="Consent to electronic communication (optional)" hint="Members may tick it when they activate.">
          <Textarea id="tc-consent" rows={3} maxLength={20000} value={form.consent_body} onChange={(e) => set("consent_body", e.target.value)} />
        </FormField>
        <div className="flex items-start gap-2">
          <Checkbox
            id="tc-reaccept"
            checked={form.requires_reacceptance}
            onCheckedChange={(on) => set("requires_reacceptance", on === true)}
            className="mt-0.5"
          />
          <Label htmlFor="tc-reaccept" className="font-normal leading-snug">
            Members must accept this version before they can use the portal again
          </Label>
        </div>
        {submitted && problems.length > 0 && (
          <ul className="space-y-1 text-xs text-destructive" role="alert">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <Button onClick={publish} disabled={submitting}>
            {submitting ? "Publishing…" : "Publish this version"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
