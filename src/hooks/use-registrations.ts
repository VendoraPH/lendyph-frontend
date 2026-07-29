// src/hooks/use-registrations.ts
import { useState, useEffect, useCallback } from "react";
import {
  registrationService,
  Registration,
  RegistrationStatus,
} from "@/services/registration.service";

interface Options {
  status?: RegistrationStatus;
  per_page?: number;
}

export function useRegistrations(options: Options = {}) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The shared `/borrowers` endpoint sometimes returns a paginated
      // envelope `{ data: [...], total, ... }` and sometimes the array
      // directly — `BorrowersPage` has the same defensive parsing.
      // Without this, pending registrations silently disappear because
      // `res.data` is undefined when the backend returns an array.
      const res = (await registrationService.list(options)) as unknown;
      const list: Registration[] = Array.isArray(res)
        ? (res as Registration[])
        : ((res as { data?: Registration[] })?.data ?? []);
      // Client-side guard: the shared /borrowers endpoint has been
      // observed to ignore the `status` query param. Filter here so the
      // "Pending Registrations" tab actually only shows pending records,
      // regardless of what the backend returned.
      const filtered = options.status
        ? list.filter((r) => r.status === options.status)
        : list;
      const totalCount = Array.isArray(res)
        ? filtered.length
        : ((res as { total?: number })?.total ?? filtered.length);
      setRegistrations(filtered);
      setTotal(totalCount);
    } catch {
      setError("We couldn't load the registrations. Please try again.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.status, options.per_page]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { registrations, total, loading, error, refresh };
}
