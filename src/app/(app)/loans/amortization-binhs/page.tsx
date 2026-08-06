import { notFound } from "next/navigation";
import { env } from "@/config/env";
import { BinhsCalculator } from "./_components/binhs-calculator";

// binhs-coop only, gated on NEXT_PUBLIC_ENABLE_BINHS_AMORTIZATION. Hiding the
// sidebar entry is not enough — a deployment without the flag must not serve
// this route by direct URL either.
//
// The gate lives in this Server Component so the calculator's client bundle is
// never sent when the flag is off — gating inside the client component would
// still ship it.
//
// Note this is a soft 404: the 404 UI renders but the response status stays 200,
// because the shell streams before the status can be set. A real 404 status
// would need a root proxy, which isn't worth it for an authenticated route.
export default function AmortizationBinhsPage() {
  if (!env.features.binhsAmortization) {
    notFound();
  }

  return <BinhsCalculator />;
}
