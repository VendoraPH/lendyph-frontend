import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { LoanAccountingSummary } from "@/types";
import {
  booksFigureViews,
  booksVsRecordsView,
  centavosOrDash,
} from "../_lib/loan-accounting-view";
import { FigureCard } from "./figure-card";

function SectionHeading({ title, caption }: { title: string; caption: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <p className="text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

/** The ledger's loans receivable at the chosen date. */
export function BooksFigures({ summary }: { summary: LoanAccountingSummary }) {
  const { figures } = booksFigureViews(summary.books);
  return (
    <section className="space-y-3" aria-labelledby="books-heading">
      <div id="books-heading">
        <SectionHeading
          title="In the books"
          caption={`The ledger as of ${formatDate(summary.as_of)}.`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {figures.map((figure) => (
          <FigureCard
            key={figure.label}
            label={figure.label}
            value={figure.value}
            hint={figure.hint}
            tone={figure.needsReview ? "warning" : "default"}
            badge={
              figure.needsReview ? (
                <Badge variant="outline" className="border-amber-300 text-amber-700">
                  Needs review
                </Badge>
              ) : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}

/** The loan records, always as of today. */
export function RecordsFigures({ summary }: { summary: LoanAccountingSummary }) {
  const { records } = summary;
  return (
    <section className="space-y-3" aria-labelledby="records-heading">
      <div id="records-heading">
        <SectionHeading
          title="On the loan records"
          caption={`As of today, ${formatDate(records.as_of)}: loan records keep no history, so these don't follow the date above.`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FigureCard
          label="Principal Balance"
          value={centavosOrDash(records.outstanding_principal)}
          hint={`${records.loan_count} ${records.loan_count === 1 ? "loan" : "loans"}`}
        />
        <FigureCard
          label="Outstanding"
          value={centavosOrDash(records.total_outstanding)}
          hint="Principal, interest, penalty and insurance premium still owed."
        />
        <FigureCard
          label="Past Due"
          value={centavosOrDash(records.past_due_amount)}
          tone="warning"
          hint={`${records.past_due_count} ${records.past_due_count === 1 ? "loan" : "loans"} past grace`}
        />
      </div>
    </section>
  );
}

/** Today's books principal against today's loan records. */
export function BooksVsRecords({ summary }: { summary: LoanAccountingSummary }) {
  const comparison = summary.books_vs_records;
  const view = booksVsRecordsView(comparison);
  const Icon = STATUS_ICONS[view.status];
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading
            title="Books against loan records"
            caption={comparison ? `As of today, ${formatDate(comparison.as_of)}.` : "As of today."}
          />
          <Badge variant="outline" className={STATUS_CLASSES[view.status]}>
            <Icon aria-hidden="true" />
            {view.label}
          </Badge>
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          {view.figures.map((figure) => (
            <div key={figure.label}>
              <dt className="text-sm text-muted-foreground">{figure.label}</dt>
              <dd className="font-mono text-lg font-semibold">{figure.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">{view.text}</p>
      </CardContent>
    </Card>
  );
}

const STATUS_ICONS = {
  reconciled: CheckCircle2,
  differs: AlertTriangle,
  pending: Clock,
} as const;

const STATUS_CLASSES = {
  reconciled: "border-green-300 text-green-700",
  differs: "border-amber-300 text-amber-700",
  pending: "text-muted-foreground",
} as const;
