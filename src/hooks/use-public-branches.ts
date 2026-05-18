// src/hooks/use-public-branches.ts
import { useEffect, useState } from "react";
import { branchService, type PublicBranch } from "@/services/branch.service";

// Unauthenticated branch list used by the public registration form so an
// applicant can pick the branch their membership belongs to. Falls back to
// an empty list on error — the page surfaces a helper message.
export function usePublicBranches() {
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    branchService
      .publicList()
      .then((res) => {
        if (cancelled) return;
        setBranches(Array.isArray(res) ? res : []);
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
