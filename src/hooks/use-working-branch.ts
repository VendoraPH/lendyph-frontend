import { useCallback, useMemo, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { env } from "@/config/env";
import { ALL_BRANCHES } from "@/lib/branch-filter";
import { branchViewer } from "@/lib/user-branches";
import {
  type BranchScopedFilters,
  type PickedUnder,
  branchFilterDefault,
  followWorkingBranch,
  forgetWorkingBranch,
  initialBranchFilters,
  nextBranchFilters,
  readWorkingBranch,
  readWorkingBranchName,
  shownBranchFilters,
  workingBranchFor,
  writeWorkingBranch,
} from "@/lib/working-branch";
import { useAuthStore } from "@/store";

const browserStorage = () => window.localStorage;

// Every mounted reader re-reads when the header switches, and when another tab
// does (the `storage` event).
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function notify(): void {
  listeners.forEach((l) => l());
}

/** Forgets a user's working branch in this browser (sign-out). */
export function forgetUserWorkingBranch(userId: number | null | undefined): void {
  forgetWorkingBranch(browserStorage, userId);
  notify();
}

export interface WorkingBranch {
  /** `NEXT_PUBLIC_ENABLE_MULTI_BRANCH`. Off: no working branch, ever. */
  enabled: boolean;
  viewAll: boolean;
  /** What is stored for this user, checked only for its form. */
  stored: number | null;
  /** The stored branch's name, kept with it so the header can show it before the list loads. */
  storedName: string | null;
  /** The working branch that counts (`workingBranchFor`), or null. */
  branchId: number | null;
  /** Switches it; null is All branches (or All my branches) and stores nothing. */
  setBranch: (branch: { id: number; name: string } | null) => void;
}

/** The signed-in user's working branch, kept per user in this browser only. */
export function useWorkingBranch(): WorkingBranch {
  const user = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const enabled = env.features.multiBranch;
  const userId = user?.id ?? null;
  const stored = useSyncExternalStore(
    subscribe,
    () => (enabled ? readWorkingBranch(browserStorage, userId) : null),
    () => null,
  );
  const storedName = useSyncExternalStore(
    subscribe,
    () => (enabled ? readWorkingBranchName(browserStorage, userId) : null),
    () => null,
  );
  const branchId = workingBranchFor({ enabled, stored, viewer: branchViewer(user, viewAll) });
  const setBranch = useCallback(
    (next: { id: number; name: string } | null) => {
      writeWorkingBranch(browserStorage, userId, next);
      notify();
    },
    [userId],
  );
  return { enabled, viewAll, stored, storedName, branchId, setBranch };
}

/**
 * A branch filter or picker's state, preset from the working branch. Until the
 * user picks on the page, the value follows the working branch (so it fills in
 * once known, and a header switch moves it); a pick holds until the working
 * branch changes again. With the flag off it is a plain `useState(toValue(null))`.
 */
export function useWorkingBranchPreset<T>(
  toValue: (working: number | null) => T,
): [T, (value: T) => void, () => void] {
  const { branchId } = useWorkingBranch();
  const [picked, setPicked] = useState<PickedUnder<T> | null>(null);
  const value = followWorkingBranch(picked, branchId, toValue(branchId));
  const setValue = useCallback((next: T) => setPicked({ value: next, working: branchId }), [branchId]);
  // Back to the preset, e.g. when a dialog opens afresh.
  const reset = useCallback(() => setPicked(null), []);
  return [value, setValue, reset];
}

/**
 * A list's `BranchFilter` state: the page's own `?branch=` (`url`) first, then
 * the working branch, then the page's default today (`fallback`, "All").
 */
export function useBranchFilter(options: { url?: string | null; fallback?: string } = {}): [
  string,
  (value: string) => void,
] {
  const { url = null, fallback = ALL_BRANCHES } = options;
  const [value, setValue] = useWorkingBranchPreset((working) => branchFilterDefault({ url, working, fallback }));
  return [value, setValue];
}

/**
 * A paged list's page, for a list whose branch filter follows the working
 * branch: a header switch sends it back to page 1.
 */
export function useBranchFollowingPage(): [number, (page: number) => void] {
  const [page, setPage] = useWorkingBranchPreset(() => 1);
  return [page, setPage];
}

/**
 * A filter object's state whose `branch_id` follows the working branch until
 * it is picked on the page (`shownBranchFilters`). Same shape as `useState`,
 * functional updates included.
 */
export function useBranchScopedFilters<T extends { branch_id?: number; page?: number }>(
  initial: () => T,
): [T, Dispatch<SetStateAction<T>>] {
  const { branchId } = useWorkingBranch();
  const [state, setState] = useState<BranchScopedFilters<T>>(() => initialBranchFilters(initial()));
  const setFilters = useCallback<Dispatch<SetStateAction<T>>>(
    (action) =>
      setState((prev) => {
        const next = typeof action === "function" ? action(shownBranchFilters(prev, branchId)) : action;
        return nextBranchFilters(prev, next, branchId);
      }),
    [branchId],
  );
  // Memoised: pages key their fetchers on the filters object.
  const filters = useMemo(() => shownBranchFilters(state, branchId), [state, branchId]);
  return [filters, setFilters];
}
