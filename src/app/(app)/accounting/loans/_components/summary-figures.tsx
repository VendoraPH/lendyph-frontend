import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { LoanAccountingSummary } from "@/types";
import { booksVsRecordsNote, centavosOrDash } from "../_lib/loan-accounting-view";
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
  const { books } = summary;
  const clearingNeedsReview = books.adjustments_clearing !== 0;
  return (
    <section className="space-y-3" aria-labelledby="books-heading">
      <div id="books-heading">
        <SectionHeading
          title="In the books"
          caption={`The ledger as of ${formatDate(summary.as_of)}.`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <FigureCard label="Gross loans receivable" value={centavosOrDash(books.gross)} />
        <FigureCard
          label="Less allowance for credit losses"
          value={centavosOrDash(books.allowance)}
        />
        <FigureCard
          label="Less unearned income on restructured loans"
          value={centavosOrDash(books.unearned_income)}
          hint="Interest and penalty capitalised at restructure, not yet collected."
        />
        <FigureCard label="Net loans receivable" value={centavosOrDash(books.net)} />
        <FigureCard
          label="Loan adjustments clearing"
          value={centavosOrDash(books.adjustments_clearing)}
          tone={clearingNeedsReview ? "warning" : "default"}
          hint="Any balance left here needs review."
          badge={
            clearingNeedsReview ? (
              <Badge variant="outline" className="border-amber-300 text-amber-700">
                Needs review
              </Badge>
            ) : undefined
          }
        />
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
  const note = booksVsRecordsNote(comparison);
  const Icon = note.reconciled ? CheckCircle2 : AlertTriangle;
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading
            title="Books against loan records"
            caption={`As of today, ${formatDate(comparison.as_of)}.`}
          />
          <Badge
            variant="outline"
            className={
              note.reconciled
                ? "border-green-300 text-green-700"
                : "border-amber-300 text-amber-700"
            }
          >
            <Icon aria-hidden="true" />
            {note.label}
          </Badge>
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">Loans receivable in the books</dt>
            <dd className="font-mono text-lg font-semibold">
              {centavosOrDash(comparison.books_principal)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Principal Balance on the loan records</dt>
            <dd className="font-mono text-lg font-semibold">
              {centavosOrDash(comparison.records_principal)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Difference (books less records)</dt>
            <dd className="font-mono text-lg font-semibold">
              {centavosOrDash(comparison.difference)}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">{note.text}</p>
      </CardContent>
    </Card>
  );
}
