import { formatCurrency } from "@/lib/format";
import { decimalInputValue } from "@/lib/percent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SavingsProduct } from "@/types/savings";
import { postingFrequencyLabel } from "../../../products/_lib/product-form";

/** The chosen product's terms, filled in automatically: rate, minimums and rules. */
export function ProductTerms({ product }: { product: SavingsProduct }) {
  const rows: [string, string][] = [
    ["Interest rate", `${decimalInputValue(product.interest_rate) || "0"}% p.a.`],
    ["Interest posting", postingFrequencyLabel(product.posting_frequency)],
    ["Minimum initial deposit", formatCurrency(product.min_initial_deposit)],
    ["Maintaining balance", formatCurrency(product.min_maintaining_balance)],
    ["Minimum to earn interest", formatCurrency(product.min_balance_to_earn_interest)],
    [
      "Withdrawal limit",
      product.max_withdrawal_amount === null ? "No limit" : `${formatCurrency(product.max_withdrawal_amount)} each`,
    ],
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{product.name} terms</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
