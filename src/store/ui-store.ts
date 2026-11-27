import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  /** The user's own collapse choice. Persisted. */
  sidebarCollapsed: boolean;
  /** Flips the sidebar between full and icons only. */
  toggleSidebarCollapsed: () => void;
}

/** Whether the sidebar shows as icons only. */
export const selectSidebarCollapsed = (s: UIState) => s.sidebarCollapsed;

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      sidebarCollapsed: false,
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
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
