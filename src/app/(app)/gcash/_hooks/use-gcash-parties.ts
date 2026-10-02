"use client";

import { useEffect, useState } from "react";
import { usePermission } from "@/hooks";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import {
  loadGCashPartyLists,
  type GCashPartyLists,
} from "../_lib/load-party-lists";
import {
  EMPTY_PARTY_LIST,
  type GCashPartyListState,
} from "../_lib/party-options";

export interface UseGCashPartiesResult {
  members: GCashPartyListState;
  nonMembers: GCashPartyListState;
  /** Nothing has loaded yet. */
  loading: boolean;
  /** The lists in hand answer an earlier search; the current one is on its way. */
  searching: boolean;
  /** Why the current search failed, if it did. */
  error: string | null;
  /** Re-runs the current search, e.g. after a walk-in is added, edited or deleted. */
  refresh(): void;
}

interface Loaded extends GCashPartyLists {
  /** Which request these lists answer. */
  key: string;
  error: string | null;
}

/**
 * Both sides of the GCash counter — members and walk-ins — for one search,
 * searched on the server (see `loadGCashPartyLists`). The caller debounces.
 *
 * Loading is derived from whether the stored result belongs to the current
 * request rather than set in the effect: an effect body that sets state
 * synchronously triggers a cascading render. The lists in hand stay on screen
 * while a newer search runs, flagged as `searching`.
 *
 * No TanStack Query here on purpose: the GCash module fetches with
 * `useState`/`useEffect` throughout, and one screen doing it differently costs
 * more than it saves.
 */
export function useGCashParties(search: string): UseGCashPartiesResult {
  // Members need `borrowers:view`, which GCash does not. Without it only the
  // walk-ins are offered, rather than a refused member list taking them down too.
  const canListMembers = usePermission().can("borrowers:view");
  const [reloadCount, setReloadCount] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = JSON.stringify([search, canListMembers, reloadCount]);

  const refresh = () => setReloadCount((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    loadGCashPartyLists({ search, canListMembers })
      .then((lists) => {
        if (!cancelled) setLoaded({ key, ...lists, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoaded({
          key,
          members: EMPTY_PARTY_LIST,
          nonMembers: EMPTY_PARTY_LIST,
          error: extractGCashErrorMessage(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [key, search, canListMembers]);

  const current = loaded?.key === key;
  return {
    members: loaded?.members ?? EMPTY_PARTY_LIST,
    nonMembers: loaded?.nonMembers ?? EMPTY_PARTY_LIST,
    loading: loaded === null,
    searching: loaded !== null && !current,
    error: current && loaded ? loaded.error : null,
    refresh,
  };
}
