import { termLabel } from "@/app/(app)/savings/_lib/time-deposit-rules";
import type { SavingsProduct, SavingsProductKind } from "@/types";

/**
 * The Product and Term choices on Open a savings account and Place a time
 * deposit (Phase 5, 14zfbg0db6m and 14zfbg0db6v). A field is never silently
 * disabled: an inactive product is listed as a disabled option, and when
 * nothing can be picked the dialog says why, in words, and where to fix it.
 * The reason is the server's `books_ready` (`GET /savings/settings`); when the
 * user can't read the settings it reads a generic sentence.
 */

export interface ProductOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ProductChoiceInput {
  /** The server's products; null while they load or couldn't be read. */
  products: readonly Pick<SavingsProduct, "id" | "code" | "name" | "kind" | "is_active">[] | null;
  kind: SavingsProductKind;
  /** The products the member check allows (Open Account); null when there is no member check to follow. */
  eligibleIds?: ReadonlySet<string> | null;
  /**
   * The products the member already holds an account in (Open Account). When
   * they hold every active one, the member check's own sentence is the reason,
   * so no notice is added.
   */
  heldProductIds?: ReadonlySet<string> | null;
  /** `books_ready` from the savings settings; null when it couldn't be read. */
  booksReady: boolean | null;
  /** Whether the user can set up the books and turn products on (`savings:settings`). */
  canManage: boolean;
}

export interface ProductChoiceEmpty {
  message: string;
  link: { href: string; label: string } | null;
}

export interface ProductChoice {
  options: ProductOption[];
  /** How many options can be picked. */
  selectable: number;
  /**
   * Why nothing can be picked, or null when something can, the products are
   * still loading, or the member already holds every active product (the
   * member check says so).
   */
  empty: ProductChoiceEmpty | null;
}

const BOOKS_FIRST = "Set up savings in the books first (Savings → Settings). It needs the chart of accounts.";
const SETTINGS_LINK = { href: "/savings/settings", label: "Open Savings Settings" };
const PRODUCTS_LINK = { href: "/savings/products", label: "Open Savings Products" };

const KIND_WORDS: Record<SavingsProductKind, string> = {
  regular: "savings product",
  time_deposit: "time deposit product",
};

function labelOf(p: { name: string; code: string }): string {
  return `${p.name} (${p.code})`;
}

/** Why no product is turned on, and where it's fixed, from `books_ready`. */
function notActiveYet(kind: SavingsProductKind, input: ProductChoiceInput, noneAtAll: boolean): ProductChoiceEmpty {
  const lead = noneAtAll
    ? `No ${KIND_WORDS[kind]} has been set up yet.`
    : `No ${KIND_WORDS[kind]} is turned on yet.`;
  if (input.booksReady === false) {
    return { message: `${lead} ${BOOKS_FIRST}`, link: input.canManage ? SETTINGS_LINK : null };
  }
  if (input.booksReady === true) {
    const fix = noneAtAll ? "Add one in Savings → Products." : "Turn a product on in Savings → Products.";
    return { message: `${lead} ${fix}`, link: input.canManage ? PRODUCTS_LINK : null };
  }
  return {
    message: `${lead} A product can be turned on once savings is set up in the books (Savings → Settings), in Savings → Products.`,
    link: input.canManage ? SETTINGS_LINK : null,
  };
}

export function productChoice(input: ProductChoiceInput): ProductChoice {
  if (input.products === null) return { options: [], selectable: 0, empty: null };
  const ofKind = input.products.filter((p) => p.kind === input.kind);
  const active = ofKind.filter((p) => p.is_active);
  const eligible = input.eligibleIds;
  const open = active.filter((p) => !eligible || eligible.has(String(p.id)));
  const closedToMember = active.filter((p) => eligible && !eligible.has(String(p.id)));
  const inactive = ofKind.filter((p) => !p.is_active);

  const options: ProductOption[] = [
    ...open.map((p) => ({ value: String(p.id), label: labelOf(p) })),
    ...closedToMember.map((p) => ({
      value: String(p.id),
      label: `${labelOf(p)} · Not open to this member`,
      disabled: true,
    })),
    ...inactive.map((p) => ({ value: String(p.id), label: `${labelOf(p)} · Not active yet`, disabled: true })),
  ];

  let empty: ProductChoiceEmpty | null = null;
  const held = input.heldProductIds;
  const holdsEveryActive = !!held && active.length > 0 && active.every((p) => held.has(String(p.id)));
  if (open.length === 0 && !holdsEveryActive) {
    empty =
      active.length > 0
        ? {
            message:
              "This member can't open any active product. They may already hold an account in each one, or a product's rules leave them out.",
            link: null,
          }
        : notActiveYet(input.kind, input, ofKind.length === 0);
  }
  return { options, selectable: open.length, empty };
}

/** The Term options of the chosen time deposit product, and a placeholder that says what to do. */
export function termChoice(product: { term_options_days: number[] | null } | null): {
  options: ProductOption[];
  placeholder: string;
} {
  if (!product) return { options: [], placeholder: "Choose a product first" };
  const terms = product.term_options_days ?? [];
  return {
    options: terms.map((d) => ({ value: String(d), label: termLabel(d) })),
    placeholder: terms.length > 0 ? "Choose a term" : "This product offers no term",
  };
}
