import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NOTHING_POSTS, POSTING_RULES } from "../_lib/posting-rules";

interface SideProps {
  /** "Dr" or "Cr", as printed on each account. */
  label: string;
  /** The side in words, for screen readers. */
  name: string;
  accounts: readonly string[];
  className: string;
}

function Side({ label, name, accounts, className }: SideProps) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={name}>
      {accounts.map((account) => (
        <li key={account} className={`rounded px-2 py-0.5 ${className}`}>
          {label} {account}
        </li>
      ))}
    </ul>
  );
}

/** What the server posts for each lending event, in plain words. */
export function PostingRulesCard() {
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What Lendy posts for you
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You record the lending transaction, and these entries are written in the same step.
          Accounts are named as the default chart names them; your organisation&apos;s account
          mapping picks the real account.
        </p>

        <ul className="mt-4 space-y-3">
          {POSTING_RULES.map((rule) => (
            <li key={rule.event} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{rule.event}</p>
              <div className="mt-1.5 flex flex-wrap items-start gap-2 text-xs">
                <Side
                  label="Dr"
                  name="Debit"
                  accounts={rule.debit}
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                />
                <ArrowRight aria-hidden="true" className="mt-1 h-3 w-3 text-muted-foreground" />
                <Side
                  label="Cr"
                  name="Credit"
                  accounts={rule.credit}
                  className="bg-blue-500/10 text-blue-700 dark:text-blue-400"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{rule.note}</p>
            </li>
          ))}
          <li className="rounded-lg border border-dashed p-3">
            <p className="text-sm font-medium">{NOTHING_POSTS.title}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
              {NOTHING_POSTS.events.map((event) => (
                <li key={event} className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                  {event}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{NOTHING_POSTS.note}</p>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
