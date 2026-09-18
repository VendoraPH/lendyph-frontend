"use client";

import { useCallback, useEffect, useState } from "react";
import { borrowerService } from "@/services/borrower.service";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { borrowerParty, nonMemberParty } from "@/lib/gcash-party";
import type { GCashParty } from "@/types";

/** What a picker needs about one selectable party, already flattened. */
export interface GCashPartyOption {
  party: GCashParty;
  /** Second line in the list row — member code, or the presented ID. */
  hint: string | null;
  /** Shown in the dialog's read-only Number field. */
  contactNumber: string | null;
  /** Everything cmdk should match a query against, joined. */
  searchText: string;
}

/** Set only when a drain gave up with pages outstanding. Null means complete. */
export interface GCashPartyShortfall {
  shown: number;
  total: number | null;
}

interface GCashPartyListState {
  options: GCashPartyOption[];
  shortfall: GCashPartyShortfall | null;
}

export interface UseGCashPartiesResult {
  members: GCashPartyListState;
  nonMembers: GCashPartyListState;
  loading: boolean;
  error: string | null;
  /** Re-drains walk-ins, e.g. after one is added from inside a dialog. */
  refreshNonMembers(): void;
}

const EMPTY: GCashPartyListState = { options: [], shortfall: null };

/**
 * Both sides of the GCash counter — members and walk-ins — as one selectable
 * list each.
 *
 * Drained rather than paged. A picker is the one place where a missing row is
 * indistinguishable from a person who was never registered: the teller types
 * "Dela Cruz", sees "No member found", and concludes the member is not in the
 * system. Asking for a single large page cannot fix that, because both
 * controllers clamp `per_page` to 100 in silence — so this follows the server's
 * own `meta.last_page` and reports a shortfall instead of hiding one.
 *
 * No TanStack Query here on purpose: the GCash module fetches with
 * `useState`/`useEffect` throughout, and one screen doing it differently costs
 * more than it saves.
 */
export function useGCashParties(): UseGCashPartiesResult {
  const [members, setMembers] = useState<GCashPartyListState>(EMPTY);
  const [nonMembers, setNonMembers] = useState<GCashPartyListState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // setLoading/setError live here rather than at the top of the effect below:
  // an effect body that sets state synchronously triggers a cascading render,
  // and an event handler is the honest place for "the user asked for a reload".
  const refreshNonMembers = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      // members_only: every option here can be transacted for, so pending and
      // rejected applicants must not be selectable at all.
      borrowerService.listAll({ members_only: 1 }),
      gcashService.listAllNonMembers(),
    ])
      .then(([memberDrain, nonMemberDrain]) => {
        if (cancelled) return;
        setMembers({
          options: memberDrain.rows.map((borrower) => ({
            party: borrowerParty(borrower),
            hint: borrower.borrower_code ?? null,
            contactNumber: borrower.contact_number ?? null,
            searchText: [borrower.full_name, borrower.borrower_code]
              .filter(Boolean)
              .join(" "),
          })),
          shortfall: memberDrain.truncated
            ? { shown: memberDrain.rows.length, total: memberDrain.total }
            : null,
        });
        setNonMembers({
          options: nonMemberDrain.rows.map((nm) => ({
            party: nonMemberParty(nm),
            hint: nm.id_type ? `${nm.id_type} · ${nm.id_number}` : null,
            contactNumber: nm.mobile_number ?? null,
            searchText: [nm.full_name, nm.mobile_number, nm.id_number]
              .filter(Boolean)
              .join(" "),
          })),
          shortfall: nonMemberDrain.truncated
            ? { shown: nonMemberDrain.rows.length, total: nonMemberDrain.total }
            : null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setMembers(EMPTY);
        setNonMembers(EMPTY);
        setError(extractGCashErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return { members, nonMembers, loading, error, refreshNonMembers };
}
