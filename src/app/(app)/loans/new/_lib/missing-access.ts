/**
 * The loan form reads lists that belong to other modules. A user without one
 * of those permissions gets that list skipped, never requested, so nothing
 * fails and nothing is logged. Without this the picker simply looks empty,
 * which reads as "there are no members" rather than "you can't see them".
 */
export interface LoanFormAccess {
  members: boolean;
  products: boolean;
  collaterals: boolean;
  shareCapital: boolean;
}

export interface MissingAccess {
  /** The permission string, e.g. `borrowers:view`. */
  permission: string;
  /** Where to grant it, as the Settings → Role and Permissions screen labels it. */
  grant: string;
  /** What the user will notice on this form without it. */
  effect: string;
  /** True when the loan cannot be submitted at all without it. */
  blocking: boolean;
}

const RULES: { key: keyof LoanFormAccess; missing: MissingAccess }[] = [
  {
    key: "members",
    missing: {
      permission: "borrowers:view",
      grant: "Members → View",
      effect: "The member and co-maker pickers are empty, so no member can be chosen.",
      blocking: true,
    },
  },
  {
    key: "products",
    missing: {
      permission: "loans:view",
      grant: "Loans → View",
      effect: "No loan product can be chosen.",
      blocking: true,
    },
  },
  {
    key: "collaterals",
    missing: {
      permission: "collaterals:view",
      grant: "Collateral Management → View",
      effect: "The member's collaterals can't be listed or attached.",
      blocking: false,
    },
  },
  {
    key: "shareCapital",
    missing: {
      permission: "share_capital:view",
      grant: "Share Capital → View",
      effect: "Share-capital collateral can't be valued, so it can't be attached.",
      blocking: false,
    },
  },
];

/** What this user can't see on the loan form, blocking gaps first. */
export function missingLoanFormAccess(access: LoanFormAccess): MissingAccess[] {
  // Share capital only matters through collaterals; without those it is moot.
  const relevant = RULES.filter(
    (r) => !(r.key === "shareCapital" && !access.collaterals),
  );
  return relevant
    .filter((r) => !access[r.key])
    .map((r) => r.missing)
    .sort((a, b) => Number(b.blocking) - Number(a.blocking));
}
