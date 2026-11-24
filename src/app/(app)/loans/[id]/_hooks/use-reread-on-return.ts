import { useEffect, useRef } from "react";
import { createReturnReader } from "../_lib/reread-on-return";

/**
 * While `active`, call `read` each time staff come back to this tab: its window
 * focused, or the tab shown again. Never on a timer, and one read per return
 * (see `createReturnReader`). The latest `read` is used, so it needn't be stable.
 */
export function useRereadOnReturn(active: boolean, read: () => Promise<unknown>): void {
  const readRef = useRef(read);
  useEffect(() => {
    readRef.current = read;
  }, [read]);

  useEffect(() => {
    if (!active) return;
    const reader = createReturnReader({
      read: () => readRef.current(),
      isHidden: () => document.hidden,
      now: () => Date.now(),
    });
    const onReturn = () => reader.handleReturn();
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      reader.dispose();
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [active]);
}
