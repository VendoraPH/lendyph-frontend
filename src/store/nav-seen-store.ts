import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { guardedStorage } from "@/lib/guarded-storage";
import { mergeSeen, sanitizeSeen, type UnseenFeed } from "@/lib/nav-unseen";

interface NavSeenState {
  /** Notification ids the user has viewed, per user id, oldest first. */
  seen: Record<string, string[]>;
  /**
   * The unread rows (id and link only) last read for the badges. Shared by the
   * desktop and mobile menus so they make one read, and never saved.
   */
  feed: UnseenFeed | null;
  /**
   * Adds `viewed` to the user's seen ids. Given `stillUnread`, ids no longer
   * in it are dropped, which keeps the list short.
   */
  markSeen: (userKey: string, viewed: readonly string[], stillUnread?: ReadonlySet<string>) => void;
  setFeed: (feed: UnseenFeed) => void;
}

/**
 * Which notifications the sidebar's "new" badges have already counted as
 * viewed (see `src/lib/nav-unseen.ts`). Kept in this browser only, as ids:
 * it's a badge, and reading a notification in the bell clears it everywhere
 * anyway. A blocked, full or damaged localStorage only loses the memory.
 */
export const useNavSeenStore = create<NavSeenState>()(
  persist(
    (set) => ({
      seen: {},
      feed: null,
      markSeen: (userKey, viewed, stillUnread) =>
        set((state) => {
          const previous = state.seen[userKey] ?? [];
          const next = mergeSeen(previous, viewed, stillUnread);
          const same = next.length === previous.length && next.every((id, i) => id === previous[i]);
          return same ? state : { seen: { ...state.seen, [userKey]: next } };
        }),
      setFeed: (feed) => set({ feed }),
    }),
    {
      name: "lendy-nav-seen",
      storage: createJSONStorage(() => guardedStorage(() => window.localStorage)),
      partialize: (state) => ({ seen: state.seen }),
      merge: (persisted, current) => ({
        ...current,
        seen: sanitizeSeen((persisted as { seen?: unknown } | undefined)?.seen),
      }),
    },
  ),
);
