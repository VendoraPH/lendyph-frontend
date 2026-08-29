"use client";

import { useCallback, useEffect, useState } from "react";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import type { GCashNonMember } from "@/types";

interface UseGCashNonMembersParams {
  search?: string;
  page: number;
  perPage: number;
}

interface UseGCashNonMembersResult {
  nonMembers: GCashNonMember[];
  total: number;
  lastPage: number;
  loading: boolean;
  error: string | null;
  refresh(): void;
}

export function useGCashNonMembers({
  search,
  page,
  perPage,
}: UseGCashNonMembersParams): UseGCashNonMembersResult {
  const [nonMembers, setNonMembers] = useState<GCashNonMember[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await gcashService.listNonMembers({
          search: search || undefined,
          page,
          per_page: perPage,
        });
        if (cancelled) return;
        setNonMembers(res?.data ?? []);
        setTotal(res?.meta?.total ?? 0);
        setLastPage(res?.meta?.last_page ?? 1);
      } catch (err) {
        if (cancelled) return;
        setNonMembers([]);
        setTotal(0);
        setLastPage(1);
        setError(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, page, perPage, reloadToken]);

  return { nonMembers, total, lastPage, loading, error, refresh };
}
