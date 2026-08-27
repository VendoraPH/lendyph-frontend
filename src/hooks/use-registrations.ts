// src/hooks/use-registrations.ts
import { useState, useEffect, useCallback } from "react";
import {
  registrationService,
  Registration,
  RegistrationStatus,
} from "@/services/registration.service";

// The API clamps `per_page` at 100. Ask for that ceiling: without an explicit
// value the backend falls back to 15, which silently capped both the pending
// registrations table and the sidebar badge at the 15 newest applicants.
const DEFAULT_PER_PAGE = 100;

interface Options {
  status?: RegistrationStatus;
  per_page?: number;
}

export function useRegistrations(options: Options = {}) {
  const { status, per_page = DEFAULT_PER_PAGE } = options;
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await registrationService.list({ status, per_page });
      const list = res.data ?? [];
      // Belt-and-braces only: the backend does honour the `status` query param
      // (BorrowerController@index filters on it). This just guarantees a
      // mislabelled row can never surface on the "Pending Registrations" tab.
      const filtered = status ? list.filter((r) => r.status === status) : list;
      // `meta.total` counts every row matching the filter, not just this page —
      // that is what makes the sidebar badge and the tab count truthful.
      setRegistrations(filtered);
      setTotal(res.meta?.total ?? filtered.length);
    } catch {
      setError("We couldn't load the registrations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [status, per_page]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { registrations, total, loading, error, refresh };
}
