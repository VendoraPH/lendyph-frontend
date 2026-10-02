"use client";

import { useEffect, useRef } from "react";
import { Info, X } from "lucide-react";
import { env } from "@/config/env";
import { cn } from "@/lib/utils";
import { LINDA_MESSAGES, LINDA_SUGGESTED_QUESTIONS } from "@/lib/linda";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLindaStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { LindaComposer } from "./linda-composer";
import { LindaMark } from "./linda-mark";
import { LindaReplyView } from "./linda-reply";
import { useLindaChat } from "./use-linda-chat";

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

/** One conversation. Remounted per opening, which is what clears it. */
function LindaConversation({ onNavigate, autoFocus }: { onNavigate: () => void; autoFocus: boolean }) {
  const { messages, pending, ask } = useLindaChat();
  const scrollRef = useRef<HTMLDivElement>(null);

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
          <Suggestions onPick={ask} />
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
        <LindaComposer disabled={pending} onSend={ask} autoFocus={autoFocus} />
      </div>
    </>
  );
}

/**
 * Linda's side panel. On desktop it sits beside the page and the page narrows
 * to make room (about 25% wide on large screens, wider on smaller ones so the
 * answers stay readable); on phones it covers the screen.
 */
export function LindaPanel() {
  const open = useLindaStore((s) => s.open);
  const session = useLindaStore((s) => s.session);
  const closePanel = useLindaStore((s) => s.closePanel);
  const isMobile = useIsMobile();

  // Leaving the app shell (logout, session end) or the page (reload) closes
  // Linda with it, which also gives back the sidebar Linda collapsed — that
  // state is persisted, so a reload would otherwise leave it stuck collapsed.
  useEffect(() => {
    window.addEventListener("pagehide", closePanel);
    return () => {
      window.removeEventListener("pagehide", closePanel);
      closePanel();
    };
  }, [closePanel]);

  if (!env.features.linda) return null;

  return (
    <aside
      id="linda-panel"
      aria-label="Linda, AI lending assistant"
      inert={!open}
      onKeyDown={(e) => {
        if (e.key === "Escape") closePanel();
      }}
      className={cn(
        "flex-col overflow-hidden bg-background md:shrink-0 md:transition-[width] md:duration-300 md:ease-in-out",
        open
          ? "fixed inset-0 z-50 flex md:static md:z-auto md:w-[40%] md:min-w-80 md:border-l md:border-border lg:w-[32%] xl:w-[25%]"
          : "hidden md:flex md:w-0",
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
          <Button variant="ghost" size="icon-sm" onClick={closePanel} className="rounded-full">
            <X className="h-4 w-4" />
            <span className="sr-only">Close Linda</span>
          </Button>
        </header>
        {session > 0 && (
          <LindaConversation
            key={session}
            onNavigate={isMobile ? closePanel : () => {}}
            autoFocus={!isMobile}
          />
        )}
      </div>
    </aside>
  );
}
