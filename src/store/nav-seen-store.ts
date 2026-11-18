import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mergeSeen } from "@/lib/nav-unseen";

interface NavSeenState {
  /** Notification ids the user has viewed, per user id, oldest first. */
  seen: Record<string, string[]>;
  /**
   * Adds `viewed` to the user's seen ids. Given `stillUnread`, ids no longer
   * in it are dropped, which keeps the list short.
   */
  markSeen: (userKey: string, viewed: readonly string[], stillUnread?: ReadonlySet<string>) => void;
}

/**
 * Which notifications the sidebar's "new" badges have already counted as
 * viewed (see `src/lib/nav-unseen.ts`). Kept in this browser only: it's a
 * badge, and reading a notification in the bell clears it everywhere anyway.
 */
export const useNavSeenStore = create<NavSeenState>()(
  persist(
    (set) => ({
      seen: {},
      markSeen: (userKey, viewed, stillUnread) =>
        set((state) => {
          const previous = state.seen[userKey] ?? [];
          const next = mergeSeen(previous, viewed, stillUnread);
          const same = next.length === previous.length && next.every((id, i) => id === previous[i]);
          return same ? state : { seen: { ...state.seen, [userKey]: next } };
        }),
    }),
    { name: "lendy-nav-seen", partialize: (state) => ({ seen: state.seen }) },
  ),
);
