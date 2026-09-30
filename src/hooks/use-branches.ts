import { useEffect, useState } from "react";
import { completeRows } from "@/lib/paginate";
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
 * An incomplete list counts as an error — a filter missing a branch cannot
 * select it, and nothing on screen would say why.
 */
export function useBranches() {
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Loads once per mount, so the initial state above already reads "loading,
  // no error" — there is nothing to reset before the request goes out.
  useEffect(() => {
    let cancelled = false;
    branchService
      .listAll()
      .then(completeRows)
      .then((rows) => {
        if (cancelled) return;
        setBranches(rows.filter((b) => b.is_active));
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
