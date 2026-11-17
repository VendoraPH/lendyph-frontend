import { create } from "zustand";
import axios from "axios";
import { lindaService } from "@/services/linda.service";
import {
  LINDA_MAX_MESSAGE_LENGTH,
  buildLindaHistory,
  lindaErrorMessage,
  type LindaMessage,
} from "@/lib/linda";
import type { LindaChatRequest, LindaReply } from "@/types/linda";
import { useAuthStore } from "./auth-store";
import { useUIStore } from "./ui-store";

/** Sends one question. `lindaService.chat`; tests pass their own. */
export type LindaChat = (request: LindaChatRequest, signal?: AbortSignal) => Promise<LindaReply>;

/**
 * Linda: where she is open, and the one conversation the side panel, the
 * expanded chat and the /linda page all show.
 *
 * Deliberately not persisted. Linda keeps no history: the conversation lives
 * in memory only, so a reload clears it, and so does closing Linda, "New
 * chat" and signing out. Leaving a page doesn't.
 */
interface LindaState {
  /** The side panel (a full-screen dialog on phones). */
  open: boolean;
  /** The large chat dialog, in place of the panel. */
  expanded: boolean;
  messages: LindaMessage[];
  /** A question is waiting for its answer. */
  pending: boolean;
  /**
   * The question in the box, typed or picked from the suggestions. It stays
   * there until Linda answers it, so a failed request can be retried or
   * reworded without typing it again.
   */
  draft: string;
  setDraft: (text: string) => void;
  /**
   * Asks Linda. Resolves `true` once she answered, and only then clears the
   * box, and only if it still holds what was sent (anything typed while
   * waiting is kept). One question at a time.
   */
  send: (text: string, chat?: LindaChat) => Promise<boolean>;
  openPanel: () => void;
  togglePanel: () => void;
  /** Closes Linda, panel or expanded chat, and clears the conversation. */
  close: () => void;
  /** Panel to the large dialog, same conversation. */
  expand: () => void;
  /** The large dialog back to the panel, same conversation. */
  collapse: () => void;
  /**
   * Puts the panel and dialog away without closing Linda: moving to /linda,
   * or following a link in a reply. The conversation stays.
   */
  hide: () => void;
  /** Clears the conversation, leaving Linda where she is. */
  newChat: () => void;
  /** Closes Linda and clears everything: sign-out, or leaving the app shell. */
  reset: () => void;
}

/** The request in flight, if any. Not state: nothing renders from it. */
let inFlight: AbortController | null = null;
let nextId = 1;

const EMPTY_CONVERSATION = { messages: [], pending: false, draft: "" } satisfies Partial<LindaState>;

/** Aborts the question in flight; its answer, if one still comes, is dropped. */
function abortInFlight() {
  inFlight?.abort();
  inFlight = null;
}

function failureText(err: unknown): string | null {
  const isAxios = axios.isAxiosError(err);
  const code = isAxios
    ? (err.response?.data as { error_code?: unknown } | undefined)?.error_code
    : undefined;
  return lindaErrorMessage(
    isAxios ? err.response?.status : undefined,
    typeof code === "string" ? code : undefined,
    axios.isCancel(err),
  );
}

export const useLindaStore = create<LindaState>()((set, get) => {
  /**
   * Shows the panel, the dialog or neither. The panel makes room by narrowing
   * the sidebar rather than the page, so the cards and tables keep their
   * width. The collapse is temporary: the user's own collapse choice is
   * neither read nor written, so it is intact after Linda closes, after a
   * reload and in other tabs. On phones the desktop sidebar is hidden, so
   * this changes nothing there. The dialog covers the page, so the sidebar
   * comes back while it shows.
   */
  const show = (open: boolean, expanded: boolean) => {
    if (open !== get().open) useUIStore.getState().setSidebarAutoCollapsed(open);
    set({ open, expanded });
  };

  const append = (message: Omit<LindaMessage, "id">) =>
    set((s) => ({ messages: [...s.messages, { ...message, id: nextId++ }] }));

  return {
    open: false,
    expanded: false,
    ...EMPTY_CONVERSATION,

    setDraft: (draft) => set({ draft }),

    send: (text, chat = lindaService.chat) => {
      const message = text.trim().slice(0, LINDA_MAX_MESSAGE_LENGTH);
      if (!message || inFlight) return Promise.resolve(false);

      const ac = new AbortController();
      inFlight = ac;
      // A conversation cleared since this question went out takes nothing from it.
      const current = () => inFlight === ac;
      const history = buildLindaHistory(get().messages);
      set({ draft: text, pending: true });
      append({ role: "user", content: message });

      return chat({ message, history }, ac.signal)
        .then(
          (reply) => {
            if (!current()) return false;
            append({ role: "assistant", content: reply.answer, reply });
            if (get().draft === text) set({ draft: "" });
            return true;
          },
          (err: unknown) => {
            if (!current()) return false;
            const failed = failureText(err);
            if (failed) append({ role: "assistant", content: failed, failed: true });
            return false;
          },
        )
        .finally(() => {
          if (!current()) return;
          inFlight = null;
          set({ pending: false });
        });
    },

    openPanel: () => {
      if (!get().open) show(true, false);
    },
    togglePanel: () => (get().open ? get().close() : get().openPanel()),
    close: () => {
      if (!get().open && !get().expanded) return;
      abortInFlight();
      show(false, false);
      set(EMPTY_CONVERSATION);
    },
    expand: () => show(false, true),
    collapse: () => show(true, false),
    hide: () => show(false, false),
    newChat: () => {
      abortInFlight();
      set(EMPTY_CONVERSATION);
    },
    reset: () => {
      abortInFlight();
      show(false, false);
      set(EMPTY_CONVERSATION);
    },
  };
});

// Signing out (or another user signing in) clears Linda, so the next user
// never sees the last one's questions or the figures in their answers.
useAuthStore.subscribe((state, prev) => {
  if (state.isAuthenticated !== prev.isAuthenticated || state.user?.id !== prev.user?.id) {
    useLindaStore.getState().reset();
  }
});
