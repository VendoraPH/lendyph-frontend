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
  /**
   * Linda collapsed the sidebar to icons when it opened, so closing it should
   * expand the sidebar again. False when the user had it collapsed already:
   * their choice is left alone.
   */
  collapsedSidebar: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
}

/** Side-by-side layout only; on phones Linda covers the screen anyway. */
const isDesktop = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

export const useLindaStore = create<LindaState>()((set, get) => ({
  open: false,
  session: 0,
  collapsedSidebar: false,
  openPanel: () => {
    if (get().open) return;
    // Make room for the panel by narrowing the sidebar rather than the page,
    // so the cards and tables keep their width.
    const collapse = isDesktop() && !useUIStore.getState().sidebarCollapsed;
    if (collapse) useUIStore.setState({ sidebarCollapsed: true });
    set((s) => ({ open: true, session: s.session + 1, collapsedSidebar: collapse }));
  },
  closePanel: () => {
    if (!get().open) return;
    if (get().collapsedSidebar) useUIStore.setState({ sidebarCollapsed: false });
    set({ open: false, collapsedSidebar: false });
  },
  togglePanel: () => (get().open ? get().closePanel() : get().openPanel()),
}));
