"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { LINDA_MESSAGES, LINDA_SUGGESTED_QUESTIONS } from "@/lib/linda";
import { useLindaStore } from "@/store";
import { ScrollBox } from "@/components/common/page-fill";
import { Spinner } from "@/components/ui/spinner";
import { LindaAvatar, LindaBust } from "./linda-avatar";
import { LindaComposer } from "./linda-composer";
import { LindaReplyView } from "./linda-reply";

function Suggestions({ onPick, withBust }: { onPick: (q: string) => void; withBust: boolean }) {
  return (
    <div className={cn("space-y-4", withBust && "mx-auto max-w-xl")}>
      {withBust && <LindaBust decorative className="mx-auto size-32 sm:size-40" />}
      <div className={cn("space-y-1", withBust && "text-center")}>
        <p className="text-sm font-medium">Ask Linda about your lending operation</p>
        <p className="text-xs text-muted-foreground">
          Answers come from your Lendy data and follow your role&apos;s access.
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground">Suggested questions</p>
        {LINDA_SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-brand-orange/50 hover:bg-brand-orange/5"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function Messages({ onNavigate }: { onNavigate: () => void }) {
  const messages = useLindaStore((s) => s.messages);
  const pending = useLindaStore((s) => s.pending);
  return (
    <div className="space-y-4">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-line break-words rounded-2xl rounded-br-sm bg-brand-orange px-3 py-2 text-sm text-brand-orange-foreground">
              {m.content}
            </p>
          </div>
        ) : (
          <div key={m.id} className="flex gap-2">
            <LindaAvatar className="mt-0.5 size-6" />
            <div
              className={cn(
                "min-w-0 flex-1 rounded-2xl rounded-tl-sm px-3 py-2 text-sm",
                m.failed
                  ? "border border-destructive/30 bg-destructive/5 text-destructive"
                  : "bg-muted/60",
              )}
            >
              {m.reply ? <LindaReplyView reply={m.reply} onNavigate={onNavigate} /> : <p>{m.content}</p>}
            </div>
          </div>
        ),
      )}
      {pending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LindaAvatar decorative className="size-6" />
          <Spinner className="size-3.5" />
          {LINDA_MESSAGES.loading}
        </div>
      )}
    </div>
  );
}

interface LindaConversationProps {
  /** Called when a link in a reply is followed. */
  onNavigate: () => void;
  /** Focus the question box on mount (not on phones, where it opens the keyboard). */
  autoFocus: boolean;
  /**
   * `fill` (the panel and the dialog): the messages take the space above the
   * composer. `page` (/linda): the messages are the page's `ScrollBox`, the
   * empty state shows Linda's bust, and the composer stays pinned at the foot.
   */
  layout: "fill" | "page";
  /** The question box, for a dialog that focuses it as it opens. */
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

/**
 * Linda's conversation: the messages, the suggestions while it's empty, and
 * the question box. Everything is read from `useLindaStore`, so the panel, the
 * expanded dialog and /linda show one conversation, and it outlives each of
 * them until Linda is closed.
 */
export function LindaConversation({ onNavigate, autoFocus, layout, inputRef: outerRef }: LindaConversationProps) {
  const count = useLindaStore((s) => s.messages.length);
  const pending = useLindaStore((s) => s.pending);
  const draft = useLindaStore((s) => s.draft);
  const setDraft = useLindaStore((s) => s.setDraft);
  const send = useLindaStore((s) => s.send);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ownInputRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = outerRef ?? ownInputRef;

  // A picked suggestion is sent at once, and the list it was picked from is
  // replaced by the conversation, so focus would drop to the page. Hand it to
  // the question box instead, ready for the follow-up.
  const pick = (text: string) => {
    send(text);
    inputRef.current?.focus({ preventScroll: true });
  };

  // Scroll this box only. scrollIntoView would also scroll every ancestor,
  // and while the panel animates open that shoves the whole app sideways.
  useEffect(() => {
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [count, pending]);

  const body = count === 0 ? (
    <Suggestions onPick={pick} withBust={layout === "page"} />
  ) : (
    <Messages onNavigate={onNavigate} />
  );

  return (
    <>
      {layout === "page" ? (
        <ScrollBox ref={scrollRef} aria-live="polite" className="px-1 py-1">
          {body}
        </ScrollBox>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
          {body}
        </div>
      )}

      <div
        className={cn(
          "shrink-0 space-y-2",
          layout === "page"
            ? "sticky bottom-0 mt-auto w-full bg-card pt-3"
            : "border-t border-border px-4 pb-4 pt-3",
        )}
      >
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
          <Info className="mt-px size-3 shrink-0" />
          {LINDA_MESSAGES.noHistory}
        </p>
        <LindaComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          disabled={pending}
          autoFocus={autoFocus}
          inputRef={inputRef}
        />
      </div>
    </>
  );
}
