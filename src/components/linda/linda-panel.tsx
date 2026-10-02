"use client";

import { useEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { env } from "@/config/env";
import { cn } from "@/lib/utils";
import { LINDA_MESSAGES, LINDA_SUGGESTED_QUESTIONS, isImeComposing } from "@/lib/linda";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLindaStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { LindaComposer } from "./linda-composer";
import { LindaMark } from "./linda-mark";
import { LindaReplyView } from "./linda-reply";
import { useLindaChat } from "./use-linda-chat";
import { useLindaPanelFocus } from "./use-linda-panel-focus";

function Suggestions({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
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

interface LindaConversationProps {
  onNavigate: () => void;
  autoFocus: boolean;
}

/**
 * One conversation, mounted only while the panel is open. Closing unmounts
 * it, which clears the chat, aborts a question in flight, and leaves no
 * borrower names or figures in the page.
 */
function LindaConversation({ onNavigate, autoFocus }: LindaConversationProps) {
  const { messages, pending, ask } = useLindaChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The question in the box, typed or picked from the suggestions. It stays
  // there until Linda answers it, so a failed request can be retried or
  // reworded without typing it again. Only what was sent is cleared, so
  // anything typed while waiting is kept.
  const [draft, setDraft] = useState("");
  const send = (text: string) => {
    setDraft(text);
    ask(text).then((answered) => {
      if (answered) setDraft((current) => (current === text ? "" : current));
    });
  };

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
  }, [messages.length, pending]);

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <Suggestions onPick={pick} />
        ) : (
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
                  <LindaMark className="mt-0.5 size-6" />
                  <div
                    className={cn(
                      "min-w-0 flex-1 rounded-2xl rounded-tl-sm px-3 py-2 text-sm",
                      m.failed
                        ? "border border-destructive/30 bg-destructive/5 text-destructive"
                        : "bg-muted/60",
                    )}
                  >
                    {m.reply ? (
                      <LindaReplyView reply={m.reply} onNavigate={onNavigate} />
                    ) : (
                      <p>{m.content}</p>
                    )}
                  </div>
                </div>
              ),
            )}
            {pending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LindaMark className="size-6" />
                <Spinner className="size-3.5" />
                {LINDA_MESSAGES.loading}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border px-4 pb-4 pt-3">
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

/**
 * Linda's side panel. On desktop it sits beside the page and the page narrows
 * to make room (about 25% wide on large screens, wider on smaller ones so the
 * answers stay readable); on phones it covers the screen as a modal dialog.
 *
 * With `NEXT_PUBLIC_ENABLE_LINDA` off this renders nothing and runs no hooks,
 * so the app is exactly as it is without Linda.
 */
export function LindaPanel() {
  if (!env.features.linda) return null;
  return <LindaSidePanel />;
}

function LindaSidePanel() {
  const open = useLindaStore((s) => s.open);
  const closePanel = useLindaStore((s) => s.closePanel);
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLElement>(null);
  const modal = open && isMobile;
  const onTab = useLindaPanelFocus(panelRef, open, modal);

  // Leaving the app shell (logout, session end) closes Linda with it, so the
  // next sign-in starts with the panel shut and the sidebar as the user left it.
  useEffect(() => () => closePanel(), [closePanel]);

  return (
    <aside
      ref={panelRef}
      id="linda-panel"
      role={modal ? "dialog" : undefined}
      aria-modal={modal || undefined}
      aria-label="Linda, AI lending assistant"
      tabIndex={modal ? -1 : undefined}
      inert={!open}
      onKeyDown={(e) => {
        // Escape while an IME is composing cancels the candidate, not Linda.
        if (e.key === "Escape" && !isImeComposing(e.nativeEvent)) closePanel();
        onTab(e);
      }}
      // Positioned in every state (fixed on phones, relative beside the page),
      // so absolutely positioned content such as the sr-only "Close Linda"
      // label is clipped by overflow-hidden instead of widening the page while
      // the panel is closed. `inset-0` moves a relative box by nothing.
      className={cn(
        "flex-col overflow-hidden bg-background outline-none md:shrink-0 md:transition-[width] md:duration-300 md:ease-in-out",
        open
          ? "fixed inset-0 z-50 flex md:relative md:z-auto md:w-[40%] md:min-w-80 md:border-l md:border-border lg:w-[32%] xl:w-[25%]"
          : "relative hidden md:flex md:w-0",
      )}
    >
      <div className="flex h-full w-full flex-col md:min-w-80">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <LindaMark />
            <div className="leading-tight">
              <p className="text-sm font-semibold">Linda</p>
              <p className="text-[11px] text-muted-foreground">AI Lending Assistant</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={closePanel}
            className="rounded-full max-md:size-11"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close Linda</span>
          </Button>
        </header>
        {open && (
          <LindaConversation
            onNavigate={isMobile ? closePanel : () => {}}
            autoFocus={!isMobile}
          />
        )}
      </div>
    </aside>
  );
}
