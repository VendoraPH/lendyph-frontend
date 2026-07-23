"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gcashService } from "@/services/gcash.service";
import type { GCashTier, GCashTransactionType } from "@/types";

interface UseGCashTiersResult {
  tiers: GCashTier[];
  loading: boolean;
  error: string | null;
  resolveCharge(amount: number, type: GCashTransactionType): number | null;
  refresh(): Promise<void>;
}

export function useGCashTiers(): UseGCashTiersResult {
  const [tiers, setTiers] = useState<GCashTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await gcashService.listTiers();
      const safe = Array.isArray(list) ? [...list] : [];
      safe.sort((a, b) => a.display_order - b.display_order);
      setTiers(safe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load the tiers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void load();
  }, [load]);

  const resolveCharge = useCallback(
    (amount: number, type: GCashTransactionType): number | null => {
      if (!Number.isFinite(amount) || amount <= 0) return null;
      const match = tiers.find(
        (t) => amount >= t.min_amount && amount <= t.max_amount,
      );
      if (!match) return null;
      return type === "cash_in" ? match.cash_in_rate : match.cash_out_rate;
    },
    [tiers],
  );

  return { tiers, loading, error, resolveCharge, refresh: load };
}
