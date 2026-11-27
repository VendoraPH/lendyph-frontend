import { formatRate } from "@/lib/format";
import type { LoanProduct } from "@/types/loan";

export type PenaltySource = NonNullable<LoanProduct["penalty_source"]>;

/**
 * Where new loans on a product take their late penalty from, in words, as the
 * server reports it (`penalty_source`). `linked` marks the configuration line,
 * which links to Settings → Penalties for users who can open it.
 */
export function penaltySourceLine(source: PenaltySource | null | undefined): { text: string; linked: boolean } {
  if (!source) return { text: "Penalty terms are not available yet.", linked: false };
  switch (source.type) {
    case "configuration":
      return { text: `Penalty: ${source.config_name ?? "a penalty configuration"} (Settings → Penalties)`, linked: true };
    case "fixed_rate":
      return { text: `Fixed ${formatRate(source.rate)}% a month (set before Penalties)`, linked: false };
    default:
      return { text: "No penalty", linked: false };
  }
}

/** A new product isn't in any configuration until one is saved with it. */
export const NEW_PRODUCT_PENALTY_LINE =
  "No penalty until you add this product to a configuration in Settings → Penalties.";
