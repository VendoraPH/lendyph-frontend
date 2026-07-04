/**
 * Mock localStorage-backed storage for the Collateral Management feature.
 *
 * The frontend ships against this layer until the backend implements the
 * `/collaterals` and `/collateral-types` endpoints. All functions return
 * Promises so swapping to real `api.*` calls is a one-file change in
 * `collateral.service.ts` / `collateral-type.service.ts`.
 */

import type {
  Collateral,
  CollateralType,
  LoanCollateral,
} from "@/types";
import { DEFAULT_COLLATERAL_TYPES } from "@/lib/collateral-seeds";

const KEY_TYPES = "lendyph.collateral_types";
const KEY_COLLATERALS = "lendyph.collaterals";
const KEY_LOAN_COLLATERALS = "lendyph.loan_collaterals";

// Loan statuses that count as "active" for the purpose of locking a
// collateral against re-attachment. Mirrors `ACTIVE_STATUSES` on
// src/app/(app)/loans/page.tsx.
export const ACTIVE_LOAN_STATUSES = new Set([
  "released",
  "current",
  "ongoing",
  "past_due",
]);

const isBrowser = () => typeof window !== "undefined";

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / serialization errors — feature is non-critical
  }
}

function nextId<T extends { id: number }>(rows: T[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Collateral Types ────────────────────────────────────────────────────

function ensureTypesSeeded(): CollateralType[] {
  const existing = readJson<CollateralType[] | null>(KEY_TYPES, null);
  if (existing && existing.length > 0) return existing;
  writeJson(KEY_TYPES, DEFAULT_COLLATERAL_TYPES);
  return DEFAULT_COLLATERAL_TYPES;
}

export const collateralTypeStorage = {
  list: async (): Promise<CollateralType[]> => {
    const rows = ensureTypesSeeded();
    return [...rows].sort((a, b) => a.display_order - b.display_order);
  },

  detail: async (id: number): Promise<CollateralType | null> => {
    const rows = ensureTypesSeeded();
    return rows.find((r) => r.id === id) ?? null;
  },

  create: async (
    data: Omit<CollateralType, "id" | "created_at" | "updated_at" | "is_seed">,
  ): Promise<CollateralType> => {
    const rows = ensureTypesSeeded();
    const row: CollateralType = {
      ...data,
      id: nextId(rows),
      is_seed: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    writeJson(KEY_TYPES, [...rows, row]);
    return row;
  },

  update: async (
    id: number,
    data: Partial<Omit<CollateralType, "id" | "created_at" | "is_seed">>,
  ): Promise<CollateralType> => {
    const rows = ensureTypesSeeded();
    const next = rows.map((r) =>
      r.id === id ? { ...r, ...data, updated_at: nowIso() } : r,
    );
    writeJson(KEY_TYPES, next);
    const updated = next.find((r) => r.id === id);
    if (!updated) throw new Error("Collateral type not found");
    return updated;
  },

  remove: async (id: number): Promise<void> => {
    const rows = ensureTypesSeeded();
    const target = rows.find((r) => r.id === id);
    if (target?.is_seed) {
      throw new Error("Default collateral types cannot be deleted.");
    }
    writeJson(
      KEY_TYPES,
      rows.filter((r) => r.id !== id),
    );
  },

  reorder: async (ids: number[]): Promise<CollateralType[]> => {
    const rows = ensureTypesSeeded();
    const indexById = new Map(ids.map((id, i) => [id, i + 1]));
    const next = rows.map((r) =>
      indexById.has(r.id)
        ? { ...r, display_order: indexById.get(r.id)!, updated_at: nowIso() }
        : r,
    );
    writeJson(KEY_TYPES, next);
    return [...next].sort((a, b) => a.display_order - b.display_order);
  },
};

// ─── Collaterals ─────────────────────────────────────────────────────────

export const collateralStorage = {
  list: async (params?: { borrower_id?: number }): Promise<Collateral[]> => {
    const rows = readJson<Collateral[]>(KEY_COLLATERALS, []);
    if (params?.borrower_id != null) {
      return rows.filter((r) => r.borrower_id === params.borrower_id);
    }
    return rows;
  },

  detail: async (id: number): Promise<Collateral | null> => {
    const rows = readJson<Collateral[]>(KEY_COLLATERALS, []);
    return rows.find((r) => r.id === id) ?? null;
  },

  create: async (
    data: Omit<Collateral, "id" | "created_at" | "updated_at">,
  ): Promise<Collateral> => {
    const rows = readJson<Collateral[]>(KEY_COLLATERALS, []);
    const row: Collateral = {
      ...data,
      id: nextId(rows),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    writeJson(KEY_COLLATERALS, [...rows, row]);
    return row;
  },

  update: async (
    id: number,
    data: Partial<Omit<Collateral, "id" | "created_at">>,
  ): Promise<Collateral> => {
    const rows = readJson<Collateral[]>(KEY_COLLATERALS, []);
    const next = rows.map((r) =>
      r.id === id ? { ...r, ...data, updated_at: nowIso() } : r,
    );
    writeJson(KEY_COLLATERALS, next);
    const updated = next.find((r) => r.id === id);
    if (!updated) throw new Error("Collateral not found");
    return updated;
  },

  remove: async (id: number): Promise<void> => {
    const rows = readJson<Collateral[]>(KEY_COLLATERALS, []);
    writeJson(
      KEY_COLLATERALS,
      rows.filter((r) => r.id !== id),
    );
    // Also detach from any loan it was attached to.
    const links = readJson<LoanCollateral[]>(KEY_LOAN_COLLATERALS, []);
    writeJson(
      KEY_LOAN_COLLATERALS,
      links.filter((l) => l.collateral_id !== id),
    );
  },
};

// ─── Loan ↔ Collateral attachments ───────────────────────────────────────

export const loanCollateralStorage = {
  listForLoan: async (loanId: number): Promise<LoanCollateral[]> => {
    const links = readJson<LoanCollateral[]>(KEY_LOAN_COLLATERALS, []);
    return links.filter((l) => l.loan_id === loanId);
  },

  listForCollateral: async (collateralId: number): Promise<LoanCollateral[]> => {
    const links = readJson<LoanCollateral[]>(KEY_LOAN_COLLATERALS, []);
    return links.filter((l) => l.collateral_id === collateralId);
  },

  attach: async (
    loanId: number,
    collateralId: number,
    snapshotValue: number,
  ): Promise<LoanCollateral> => {
    const links = readJson<LoanCollateral[]>(KEY_LOAN_COLLATERALS, []);
    const exists = links.find(
      (l) => l.loan_id === loanId && l.collateral_id === collateralId,
    );
    if (exists) return exists;
    const row: LoanCollateral = {
      loan_id: loanId,
      collateral_id: collateralId,
      snapshot_value: snapshotValue,
      attached_at: nowIso(),
    };
    writeJson(KEY_LOAN_COLLATERALS, [...links, row]);
    return row;
  },

  detach: async (loanId: number, collateralId: number): Promise<void> => {
    const links = readJson<LoanCollateral[]>(KEY_LOAN_COLLATERALS, []);
    writeJson(
      KEY_LOAN_COLLATERALS,
      links.filter(
        (l) => !(l.loan_id === loanId && l.collateral_id === collateralId),
      ),
    );
  },

  /**
   * For each collateral, returns the active-loan info if any. Caller
   * supplies the loans list (to avoid fetching it twice in pages that
   * already load it).
   */
  buildActiveLoanIndex: (
    loans: { id: number; status: string; loan_account_number?: string }[],
  ): Map<number, { loan_id: number; loan_account_number?: string }> => {
    const links = readJson<LoanCollateral[]>(KEY_LOAN_COLLATERALS, []);
    const activeLoanById = new Map(
      loans
        .filter((l) => ACTIVE_LOAN_STATUSES.has(l.status))
        .map((l) => [l.id, l]),
    );
    const index = new Map<
      number,
      { loan_id: number; loan_account_number?: string }
    >();
    for (const link of links) {
      const loan = activeLoanById.get(link.loan_id);
      if (loan) {
        index.set(link.collateral_id, {
          loan_id: loan.id,
          loan_account_number: loan.loan_account_number,
        });
      }
    }
    return index;
  },
};
