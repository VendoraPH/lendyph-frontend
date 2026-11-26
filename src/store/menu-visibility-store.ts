import { create } from "zustand";
import { moduleHidden } from "@/constants/menu-modules";
import { menuVisibilityService } from "@/services/menu-visibility.service";
import type { MenuVisibilityHidden } from "@/types/menu-visibility";

/** Reads the hidden keys: `menuVisibilityService.hidden`; tests pass their own. */
export type FetchHidden = () => Promise<MenuVisibilityHidden>;
/** Runs `fn` after `ms` and returns a cancel; `setTimeout` outside tests. */
export type Schedule = (fn: () => void, ms: number) => () => void;

/** How long the `failures`-th failed load in a row waits before trying again: 5 s, doubling, at most a minute. */
export function retryDelayMs(failures: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, failures - 1), 60_000);
}

interface MenuVisibilityState {
  /** The last list the server sent; empty until one arrives. */
  hidden: readonly string[];
  /** True once the first load has answered or failed, so the menu can stop showing its skeleton. */
  loaded: boolean;
  /** Whether the menus, pages and Linda leave this module out (it, or its parent, is hidden). */
  isHidden: (key: string | null | undefined) => boolean;
  /** Asks the server again; a failure keeps the last list and retries. */
  load: () => Promise<void>;
  /** Cancels a pending retry (the app shell is leaving). */
  stop: () => void;
}

/**
 * The visibility source. Not persisted: the (app) layout loads it after
 * sign-in and again when the window regains focus, and Menu Visibility
 * reloads it as soon as a save lands. The list holds module keys only.
 */
export function createMenuVisibilityStore(fetchHidden: FetchHidden, schedule: Schedule) {
  let inFlight: Promise<void> | null = null;
  let failures = 0;
  let cancelRetry: (() => void) | null = null;

  const clearRetry = () => {
    cancelRetry?.();
    cancelRetry = null;
  };

  return create<MenuVisibilityState>()((set, get) => ({
    hidden: [],
    loaded: false,
    isHidden: (key) => moduleHidden(key, new Set(get().hidden)),
    load: () => {
      if (inFlight) return inFlight;
      inFlight = fetchHidden()
        .then(
          (answer) => {
            failures = 0;
            clearRetry();
            const hidden = Array.isArray(answer?.hidden)
              ? answer.hidden.filter((key): key is string => typeof key === "string")
              : [];
            set({ hidden, loaded: true });
          },
          () => {
            failures += 1;
            clearRetry();
            cancelRetry = schedule(() => {
              cancelRetry = null;
              void get().load();
            }, retryDelayMs(failures));
            set({ loaded: true });
          },
        )
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
    stop: clearRetry,
  }));
}

const browserSchedule: Schedule = (fn, ms) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export const useMenuVisibilityStore = createMenuVisibilityStore(menuVisibilityService.hidden, browserSchedule);
