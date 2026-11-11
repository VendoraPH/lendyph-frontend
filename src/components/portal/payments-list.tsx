import { Money } from "@/components/portal/money";
import { formatDate } from "@/lib/format";
import { isNilAmount } from "@/lib/savings/amount-text";
import { NONE, PAYMENT_METHOD, labelOf } from "@/lib/portal/labels";
import type { LoanPayment } from "@/lib/portal/types";

const PARTS: { key: keyof LoanPayment; label: string }[] = [
  { key: "principal", label: "Principal" },
  { key: "interest", label: "Interest" },
  { key: "penalty", label: "Penalty" },
  { key: "insurance", label: "Insurance premium" },
  { key: "build_up", label: "Share capital build-up" },
];

/** Posted loan payments as cards: what was received and what each part went to, as the server split it. */
export function PaymentsList({ payments, showLoan = false }: { payments: LoanPayment[]; showLoan?: boolean }) {
  return (
    <ul className="space-y-3">
      {payments.map((p, index) => (
        <li key={`${p.receipt_number ?? "receipt"}-${index}`} className="rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{p.payment_date ? formatDate(p.payment_date) : NONE}</p>
              <p className="text-xs text-muted-foreground break-words">
                Receipt {p.receipt_number ?? NONE}
                {showLoan && p.loan_account_number ? ` · ${p.loan_account_number}` : ""}
                {` · ${labelOf(PAYMENT_METHOD, p.method)}`}
                {p.reference_number ? ` · Ref. ${p.reference_number}` : ""}
              </p>
            </div>
            <Money value={p.amount_paid} className="text-base font-semibold" />
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            {PARTS.filter((part) => !isNilAmount(p[part.key] as string)).map((part) => (
              <div key={part.key} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{part.label}</dt>
                <dd>
                  <Money value={p[part.key] as string} />
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
