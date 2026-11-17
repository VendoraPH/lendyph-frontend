"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { PublicApplicationPortal } from "@/types/loan-origination";

export function Landing({
  token,
  portal,
  onStart,
  onResume,
}: {
  token: string;
  portal: PublicApplicationPortal;
  onStart: () => void;
  onResume: () => void;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">{portal.welcome_heading}</h1>
        {portal.intro && <p className="whitespace-pre-line text-muted-foreground">{portal.intro}</p>}
        {portal.estimated_minutes && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" /> About {portal.estimated_minutes} minutes. You can save and finish later.
          </p>
        )}
      </section>

      {!portal.accepting ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {portal.closed_reason ?? "We are not taking new applications through this link right now."}
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
      <p className="text-sm">
        Already applied?{" "}
        <Link href={`/apply/${token}/track`} className="font-medium text-brand-orange underline-offset-4 hover:underline">
          Check your application status
        </Link>
      </p>

      {portal.eligibility && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">Who may apply</h2>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{portal.eligibility}</p>
        </section>
      )}

      {portal.products.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Loans offered</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {portal.products.map((p) => (
              <li key={p.id} className="rounded-xl border bg-card p-4 text-sm">
                <p className="font-medium">{p.name}</p>
                <p className="text-muted-foreground">
                  {formatCurrency(p.min_amount)} to {formatCurrency(p.max_amount)} · up to {p.max_term} {p.term_unit}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {portal.documents.length > 0 && (
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
    </div>
  );
}
