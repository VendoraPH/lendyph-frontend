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
      effect:
        "Share capital values are hidden for your role, so a share capital pledge can't be added. One the loan already holds stays attached.",
      blocking: false,
    },
  },
];

/**
 * On an edit the member is fixed, so without `borrowers:view` only the
 * co-makers can't change and nothing is blocked. The Chairman/Chairwoman's
 * edit at their approval step is the edit a role without it opens.
 */
const MEMBERS_ON_AN_EDIT: MissingAccess = {
  permission: "borrowers:view",
  grant: "Members → View",
  effect: "The co-maker pickers can't search members, so co-makers can't be changed.",
  blocking: false,
};

/**
 * Where the form shows what the user can't see. The Chairman/Chairwoman's
 * approval edit fits the screen at 1024x640 (UI round), so nothing stacks
 * above its form: the member gap reads beside the co-maker pickers, and the
 * collateral step isn't shown at all without `collaterals:view`. Every other
 * mode keeps the notice above the form.
 */
export function missingAccessPlacement(
  missing: MissingAccess[],
  inApproval: boolean,
): { aboveForm: MissingAccess[]; coMakersNote: string | null } {
  if (!inApproval) return { aboveForm: missing, coMakersNote: null };
  return {
    aboveForm: [],
    coMakersNote: missing.find((m) => m.permission === "borrowers:view")?.effect ?? null,
  };
}

/** What this user can't see on the loan form, blocking gaps first. */
export function missingLoanFormAccess(
  access: LoanFormAccess,
  options: { editing?: boolean } = {},
): MissingAccess[] {
  // Share capital only matters through collaterals; without those it is moot.
  const relevant = RULES.filter(
    (r) => !(r.key === "shareCapital" && !access.collaterals),
  );
  return relevant
    .filter((r) => !access[r.key])
    .map((r) => (options.editing && r.key === "members" ? MEMBERS_ON_AN_EDIT : r.missing))
    .sort((a, b) => Number(b.blocking) - Number(a.blocking));
}
