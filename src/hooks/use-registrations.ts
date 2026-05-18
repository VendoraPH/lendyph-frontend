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
      const res = await registrationService.list(options);
      setRegistrations(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {
      setError("Failed to load registrations");
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
