"use client";

import { useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { portalService } from "@/lib/portal/portal-api";
import type { PortalTerms } from "@/lib/portal/types";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { LoadState } from "./load-state";

interface TermsConsentProps {
  accepted: boolean;
  onAccepted: (value: boolean) => void;
  consent: boolean;
  onConsent: (value: boolean) => void;
  /** Hands the loaded version up, so the accept call names the one the member read. */
  children: (terms: PortalTerms) => React.ReactNode;
}

/**
 * The current Terms of Use, Privacy Notice and electronic-communication
 * consent, with the required "I accept" tick and the optional consent tick.
 * Used on activation and on the forced re-acceptance page.
 */
export function TermsConsent({ accepted, onAccepted, consent, onConsent, children }: TermsConsentProps) {
  const fetcher = useCallback(() => portalService.terms(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load the terms. Please try again.");

  return (
    <LoadState loading={loading} error={error} onRetry={reload}>
      {data && (
        <div className="space-y-4">
          <div
            className="max-h-72 space-y-4 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm"
            tabIndex={0}
            role="region"
            aria-label={`${data.title}, version ${data.version}`}
          >
            <section>
              <h2 className="mb-1 font-semibold">Terms of Use</h2>
              <p className="whitespace-pre-line">{data.terms_body}</p>
            </section>
            <section>
              <h2 className="mb-1 font-semibold">Privacy Notice</h2>
              <p className="whitespace-pre-line">{data.privacy_body}</p>
            </section>
            {data.consent_body && (
              <section>
                <h2 className="mb-1 font-semibold">Electronic communication</h2>
                <p className="whitespace-pre-line">{data.consent_body}</p>
              </section>
            )}
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="terms-accept" checked={accepted} onCheckedChange={(v) => onAccepted(v === true)} />
            <Label htmlFor="terms-accept" className="leading-snug font-normal">
              I have read and accept the Terms of Use and the Privacy Notice (version {data.version}).
            </Label>
          </div>
          {data.consent_body && (
            <div className="flex items-start gap-3">
              <Checkbox id="terms-ecomm" checked={consent} onCheckedChange={(v) => onConsent(v === true)} />
              <Label htmlFor="terms-ecomm" className="leading-snug font-normal">
                I agree to receive notices from the cooperative electronically. (Optional)
              </Label>
            </div>
          )}
          {children(data)}
        </div>
      )}
    </LoadState>
  );
}
