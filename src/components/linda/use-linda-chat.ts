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
 */
export function useLindaChat() {
  const [messages, setMessages] = useState<LindaMessage[]>([]);
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const controller = useRef<AbortController | null>(null);

  // An answer that lands after the panel closed has nowhere to go.
  useEffect(() => () => controller.current?.abort(), []);

  const ask = useCallback(
    (text: string) => {
      const message = text.trim().slice(0, LINDA_MAX_MESSAGE_LENGTH);
      if (!message || pending) return;

      const history = buildLindaHistory(messages);
      const userMessage: LindaMessage = { id: nextId.current++, role: "user", content: message };
      setMessages((prev) => [...prev, userMessage]);
      setPending(true);

      const ac = new AbortController();
      controller.current = ac;

      lindaService
        .chat({ message, history }, ac.signal)
        .then((reply) => {
          setMessages((prev) => [
            ...prev,
            { id: nextId.current++, role: "assistant", content: reply.answer, reply },
          ]);
          setPending(false);
        })
        .catch((err: unknown) => {
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
          setPending(false);
        });
    },
    [messages, pending],
  );

  return { messages, pending, ask };
}
