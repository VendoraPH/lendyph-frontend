"use client";

import { useEffect, useRef } from "react";
import { Maximize2, X } from "lucide-react";
import { lindaPanelClass } from "@/lib/linda-panel";
import { isImeComposing } from "@/lib/linda";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLindaStore } from "@/store";
import { Button } from "@/components/ui/button";
import { LindaAvatar } from "./linda-avatar";
import { LindaConversation } from "./linda-conversation";
import { LindaGate } from "./linda-gate";
import { LindaNewChatButton } from "./linda-new-chat-button";
import { useLindaPanelFocus } from "./use-linda-panel-focus";

/**
 * Linda's side panel. On desktop it's a side pop-up that slides in over the
 * page's right edge, so the page and the sidebar never move; on phones it
 * covers the screen as a modal dialog.
 * On desktop its expand button opens the same conversation in a large dialog
 * (`LindaModal`).
 *
 * The conversation is the store's (`useLindaStore`), so it survives moving
 * between the panel, the dialog and /linda. Closing clears it.
 *
 * With `NEXT_PUBLIC_ENABLE_LINDA` off this renders nothing and runs no hooks,
 * so the app is exactly as it is without Linda. Without `linda:use` it renders
 * nothing either.
 */
export function LindaPanel() {
  return (
    <LindaGate>
      <LindaSidePanel />
    </LindaGate>
  );
}

function LindaSidePanel() {
  const open = useLindaStore((s) => s.open);
  const close = useLindaStore((s) => s.close);
  const expand = useLindaStore((s) => s.expand);
  const hide = useLindaStore((s) => s.hide);
  const reset = useLindaStore((s) => s.reset);
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modal = open && isMobile;
  const onTab = useLindaPanelFocus(panelRef, open, modal);

  // Leaving the app shell (logout, session end) closes Linda and clears the
  // conversation, so the next sign-in starts with the panel shut, nothing in
  // memory, and the sidebar as the user left it.
  useEffect(() => () => reset(), [reset]);

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
        if (e.key === "Escape" && !isImeComposing(e.nativeEvent)) close();
        onTab(e);
      }}
      className={lindaPanelClass(open)}
    >
      <div className="flex h-full w-full flex-col md:min-w-80">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <LindaAvatar decorative />
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold">Linda</p>
              <p className="truncate text-[11px] text-muted-foreground">AI Lending Assistant</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LindaNewChatButton className="max-md:size-11" inputRef={inputRef} />
            {/* Phones already show the panel full screen. */}
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={expand}
                aria-label="Expand chat"
                title="Expand chat"
                className="rounded-full"
              >
                <Maximize2 aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={close} className="rounded-full max-md:size-11">
              <X className="h-4 w-4" />
              <span className="sr-only">Close Linda</span>
            </Button>
          </div>
        </header>
        {open && (
          <LindaConversation
            layout="fill"
            // On phones the panel covers the page, so a followed link puts it
            // away (the conversation stays for the floating button).
            onNavigate={isMobile ? hide : () => {}}
            autoFocus={!isMobile}
            inputRef={inputRef}
          />
        )}
      </div>
    </aside>
  );
}
