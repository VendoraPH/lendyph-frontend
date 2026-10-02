"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { LINDA_MAX_MESSAGE_LENGTH } from "@/lib/linda";
import { Button } from "@/components/ui/button";

interface LindaComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
  autoFocus?: boolean;
}

/** The question box. Enter sends, Shift+Enter starts a new line. */
export function LindaComposer({ disabled, onSend, autoFocus }: LindaComposerProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Not the autoFocus attribute: focusing scrolls ancestors into view, and
  // while the panel animates open that shifts the whole app sideways.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const canSend = !disabled && text.trim() !== "";

  const send = () => {
    if (!canSend) return;
    onSend(text);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // isComposing: Enter that confirms an IME candidate must not send.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="How can I help you today?"
        aria-label="Ask Linda a question"
        maxLength={LINDA_MAX_MESSAGE_LENGTH}
        rows={1}
        className="field-sizing-content max-h-32 min-h-6 flex-1 resize-none bg-transparent py-0.5 text-base outline-none placeholder:text-muted-foreground md:text-sm"
      />
      <Button
        type="button"
        size="icon-sm"
        onClick={send}
        disabled={!canSend}
        className="rounded-full bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
      >
        <SendHorizontal className="size-3.5" />
        <span className="sr-only">Send</span>
      </Button>
    </div>
  );
}
