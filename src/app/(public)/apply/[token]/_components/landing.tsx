"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicPortal } from "@/types/public-application";
import { linkClosure, trackingClosure } from "../_lib/portal-state";
import { NoticeText } from "./notice-text";
import { ProductFacts } from "./step-product";

/**
 * The link's landing page. A link that takes no application (the server's
 * `accepting` is false, or no code can reach anyone) shows why, in the
 * server's words, and offers only tracking while a code can still be sent.
 */
export function Landing({
  token,
  portal,
  notice,
  onStart,
  onResume,
}: {
  token: string;
  portal: PublicPortal;
  /** A line from the last step, such as having signed out. */
  notice: string | null;
  onStart: () => void;
  onResume: () => void;
}) {
  const closed = linkClosure(portal);
  const canTrack = trackingClosure(portal) === null;
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">{portal.welcome_heading}</h1>
        {portal.intro && <p className="whitespace-pre-line text-muted-foreground">{portal.intro}</p>}
        {portal.estimated_minutes && !closed && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" /> About {portal.estimated_minutes} minutes. You can save and finish later.
          </p>
        )}
      </section>

      {notice && (
        <p className="rounded-xl border bg-muted/40 p-4 text-sm" role="status">
          {notice}
        </p>
      )}

      {closed ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" role="status">
          {closed}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={onStart}>
            Start an application
          </Button>
          <Button size="lg" variant="outline" onClick={onResume}>
            Continue a saved application
          </Button>
        </div>
      )}
      {canTrack && (
        <p className="text-sm">
          Already applied?{" "}
          <Link href={`/apply/${token}/track`} className="font-medium text-brand-orange underline-offset-4 hover:underline">
            Check your application status
          </Link>
        </p>
      )}

      {portal.eligibility && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">Who may apply</h2>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{portal.eligibility}</p>
        </section>
      )}

      {!closed && portal.products.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Loans offered</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {portal.products.map((p) => (
              <li key={p.id} className="space-y-1 rounded-xl border bg-card p-4 text-sm">
                <p className="font-medium">{p.name}</p>
                <span className="text-muted-foreground">
                  <ProductFacts product={p} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!closed && portal.documents.length > 0 && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Have these ready</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {portal.documents.map((d) => (
              <li key={d.type}>
                {d.label}
                {!d.required && <span className="text-muted-foreground"> (if you have it)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {portal.privacy_notice && <NoticeText label="Privacy notice" notice={portal.privacy_notice} />}
    </div>
  );
}
