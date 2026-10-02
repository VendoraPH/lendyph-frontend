import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  /** The user's own collapse choice. Persisted. */
  sidebarCollapsed: boolean;
  /**
   * A temporary collapse that something on screen asks for, e.g. Linda's
   * panel making room. Never persisted, so it cannot outlive the page or leak
   * into another tab, and it never overwrites the user's own choice.
   */
  sidebarAutoCollapsed: boolean;
  setSidebarAutoCollapsed: (collapsed: boolean) => void;
  /**
   * Flips what the user sees, and that becomes their choice: expanding a
   * temporarily collapsed sidebar ends the temporary collapse.
   */
  toggleSidebarCollapsed: () => void;
}

/** Whether the sidebar shows as icons only, whoever asked for it. */
export const selectSidebarCollapsed = (s: UIState) => s.sidebarCollapsed || s.sidebarAutoCollapsed;

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      sidebarCollapsed: false,
      sidebarAutoCollapsed: false,
      setSidebarAutoCollapsed: (collapsed) => set({ sidebarAutoCollapsed: collapsed }),
      toggleSidebarCollapsed: () =>
        set((state) => ({
          sidebarCollapsed: !selectSidebarCollapsed(state),
          sidebarAutoCollapsed: false,
        })),
    }),
    {
      name: "lendy-ui",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
