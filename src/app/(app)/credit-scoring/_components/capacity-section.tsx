import { capacityView } from "@/lib/credit-scoring/capacity";
import type { CreditCapacity } from "@/types/credit-scoring";

/** The server's capacity figures, or a neutral line when there are none or they're hidden. */
export function CapacitySection({
  capacity,
  financialsHidden,
}: {
  capacity: CreditCapacity | null;
  financialsHidden: boolean;
}) {
  const view = capacityView(capacity, financialsHidden);

  return (
    <section aria-labelledby="capacity-heading" className="space-y-2">
      <h3 id="capacity-heading" className="text-sm font-medium">
        Capacity to Pay
      </h3>
      {view.kind === "rows" ? (
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {view.rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 border-b py-1.5">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right">
                <span className="font-medium tabular-nums">{row.value}</span>
                {row.note && <span className="block text-xs text-muted-foreground">{row.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">{view.note}</p>
      )}
    </section>
  );
}
