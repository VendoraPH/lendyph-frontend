import { create } from "zustand";

interface UnreadCountState {
  /** The bell's latest unread count from the server; null while no bell reads. */
  count: number | null;
  /** When that count was read (ms), so a read that repeats the count still shows. */
  readAt: number;
  publish: (count: number) => void;
  clear: () => void;
}

/**
 * The bell's unread count as the server last answered it (never its optimistic
 * figure), so the sidebar's "new" badges follow the bell's 60 s schedule
 * instead of polling on their own. Not persisted.
 */
export const useUnreadCountStore = create<UnreadCountState>()((set) => ({
  count: null,
  readAt: 0,
  publish: (count) => set({ count, readAt: Date.now() }),
  clear: () => set({ count: null, readAt: 0 }),
}));
