import { useEffect, useState } from "react";
import { branchService, type ApiBranch } from "@/services/branch.service";

/**
 * Authenticated branch list, for staff-facing branch filters.
 *
 * Distinct from `usePublicBranches`, which hits the unauthenticated slim
 * endpoint for the public registration form and deliberately omits codes and
 * the active flag — both of which a staff filter needs.
 *
 * Fails soft: an error leaves the list empty so callers fall back to
 * "All Branches" instead of blocking the page on a filter that is optional.
 */
export function useBranches() {
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    branchService
      .list()
      .then((res) => {
        if (cancelled) return;
        setBranches(Array.isArray(res) ? res.filter((b) => b.is_active) : []);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Unable to load branches.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { branches, loading, error };
}
