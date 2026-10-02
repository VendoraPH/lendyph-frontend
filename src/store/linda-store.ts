import { create } from "zustand";
import { useUIStore } from "./ui-store";

/**
 * Whether Linda's panel is open. Deliberately not persisted: Linda keeps no
 * history, and a panel that reopened itself after a reload would suggest it
 * did.
 */
interface LindaState {
  open: boolean;
  /** Bumped on every open, so each opening starts a fresh conversation. */
  session: number;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
}

export const useLindaStore = create<LindaState>()((set, get) => ({
  open: false,
  session: 0,
  openPanel: () => {
    if (get().open) return;
    // Make room for the panel by narrowing the sidebar rather than the page,
    // so the cards and tables keep their width. The collapse is temporary:
    // the user's own collapse choice is neither read nor written, so it is
    // intact after Linda closes, after a reload and in other tabs. On phones
    // the desktop sidebar is hidden, so this changes nothing there.
    useUIStore.getState().setSidebarAutoCollapsed(true);
    set((s) => ({ open: true, session: s.session + 1 }));
  },
  closePanel: () => {
    if (!get().open) return;
    useUIStore.getState().setSidebarAutoCollapsed(false);
    set({ open: false });
  },
  togglePanel: () => (get().open ? get().closePanel() : get().openPanel()),
}));
