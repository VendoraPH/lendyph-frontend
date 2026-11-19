import type { StateStorage } from "zustand/middleware";

/**
 * A browser storage whose every call is guarded: a blocked storage
 * (SecurityError), a full one (QuotaExceededError) or none at all (server
 * render) reads as empty and drops writes, and never throws into the page.
 * For values that are only a convenience, such as the sidebar's "new" badges.
 */
export function guardedStorage(getStorage: () => Storage): StateStorage {
  return {
    getItem: (name) => {
      try {
        return getStorage().getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        getStorage().setItem(name, value);
      } catch {
        // Not saved: the badges still work for this page instance.
      }
    },
    removeItem: (name) => {
      try {
        getStorage().removeItem(name);
      } catch {
        // Nothing to remove from a storage that can't be reached.
      }
    },
  };
}
