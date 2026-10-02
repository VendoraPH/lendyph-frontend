"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { lindaService } from "@/services/linda.service";
import {
  LINDA_MAX_MESSAGE_LENGTH,
  buildLindaHistory,
  lindaErrorMessage,
  type LindaMessage,
} from "@/lib/linda";

/**
 * One Linda conversation. Messages live in this hook's state and nowhere
 * else: no store, no localStorage. The panel remounts it on every open, which
 * is what "chat history is not saved" means on this side.
 *
 * `active` is whether the panel is open. Closing it, or unmounting the
 * conversation, aborts the question in flight: the server can stop working on
 * it, and no answer lands in a hidden panel.
 */
export function useLindaChat(active: boolean) {
  const [messages, setMessages] = useState<LindaMessage[]>([]);
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  /** The request in flight, if any. One at a time, even on a fast double Enter. */
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) controller.current?.abort();
  }, [active]);
  useEffect(() => () => controller.current?.abort(), []);

  /**
   * Resolves `true` once Linda answered, so the composer keeps the question
   * for another try until then.
   */
  const ask = useCallback(
    (text: string): Promise<boolean> => {
      const message = text.trim().slice(0, LINDA_MAX_MESSAGE_LENGTH);
      if (!message || controller.current) return Promise.resolve(false);

      const ac = new AbortController();
      controller.current = ac;
      const history = buildLindaHistory(messages);
      setMessages((prev) => [...prev, { id: nextId.current++, role: "user", content: message }]);
      setPending(true);

      return lindaService
        .chat({ message, history }, ac.signal)
        .then(
          (reply) => {
            setMessages((prev) => [
              ...prev,
              { id: nextId.current++, role: "assistant", content: reply.answer, reply },
            ]);
            return true;
          },
          (err: unknown) => {
            const isAxios = axios.isAxiosError(err);
            const code = isAxios
              ? (err.response?.data as { error_code?: unknown } | undefined)?.error_code
              : undefined;
            const text = lindaErrorMessage(
              isAxios ? err.response?.status : undefined,
              typeof code === "string" ? code : undefined,
              axios.isCancel(err),
            );
            if (text) {
              setMessages((prev) => [
                ...prev,
                { id: nextId.current++, role: "assistant", content: text, failed: true },
              ]);
            }
            return false;
          },
        )
        .finally(() => {
          controller.current = null;
          setPending(false);
        });
    },
    [messages],
  );

  return { messages, pending, ask };
}
