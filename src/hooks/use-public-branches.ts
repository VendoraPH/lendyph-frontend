// src/hooks/use-public-branches.ts
import { useEffect, useState } from "react";
import { completeRows } from "@/lib/paginate";
import { branchService, type PublicBranch } from "@/services/branch.service";

// Unauthenticated branch list used by the public registration form so an
// applicant can pick the branch their membership belongs to. Falls back to
// an empty list on error — the page surfaces a helper message. An incomplete
// list is treated as an error: an applicant whose branch is missing would
// otherwise register under the wrong one.
export function usePublicBranches() {
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Loads once per mount, so the initial state above already reads "loading,
  // no error" — there is nothing to reset before the request goes out.
  useEffect(() => {
    let cancelled = false;
    branchService
      .publicListAll()
      .then(completeRows)
      .then((rows) => {
        if (cancelled) return;
        setBranches(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Unable to load branches. Refresh to retry.");
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
