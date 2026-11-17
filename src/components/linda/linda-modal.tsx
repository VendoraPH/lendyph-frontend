"use client";

import { useRef } from "react";
import { Minimize2, XIcon } from "lucide-react";
import { useLindaStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LindaAvatar } from "./linda-avatar";
import { LindaConversation } from "./linda-conversation";
import { LindaGate } from "./linda-gate";
import { LindaNewChatButton } from "./linda-new-chat-button";
import { LINDA_FAB_ID } from "./use-linda-panel-focus";

/**
 * The panel's conversation, expanded: a large dialog (up to 960 px wide and
 * 85% of the window's height) over the page, opened from the panel's expand
 * button. The collapse button puts it back in the panel; Esc and the close
 * button close Linda, which clears the conversation as closing the panel does.
 */
export function LindaModal() {
  return (
    <LindaGate>
      <LindaExpandedChat />
    </LindaGate>
  );
}

/**
 * Where focus goes as the dialog closes. Back to the panel: its question box
 * takes focus as it mounts, so the dialog leaves it there. Closed: the
 * floating button, which shows again in the same render. Otherwise (a link
 * followed to /linda, where the button hides) the dialog's own default.
 */
function focusAfterClose(): boolean | HTMLElement {
  if (useLindaStore.getState().open) return false;
  return document.getElementById(LINDA_FAB_ID) ?? true;
}

function LindaExpandedChat() {
  const expanded = useLindaStore((s) => s.expanded);
  const close = useLindaStore((s) => s.close);
  const collapse = useLindaStore((s) => s.collapse);
  const hide = useLindaStore((s) => s.hide);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <Dialog open={expanded} onOpenChange={(next) => !next && close()}>
      <DialogContent
        size="full"
        showCloseButton={false}
        initialFocus={inputRef}
        finalFocus={focusAfterClose}
        className="gap-0 overflow-hidden p-0 sm:max-h-[85dvh] sm:max-w-[960px]"
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <LindaAvatar decorative />
            <div className="min-w-0 leading-tight">
              <DialogTitle className="text-sm font-semibold">Linda</DialogTitle>
              <DialogDescription className="truncate text-[11px] text-muted-foreground">
                AI Lending Assistant
              </DialogDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LindaNewChatButton />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={collapse}
              aria-label="Collapse to panel"
              title="Collapse to panel"
              className="rounded-full"
            >
              <Minimize2 aria-hidden="true" className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={close}
              aria-label="Close Linda"
              title="Close Linda"
              className="rounded-full"
            >
              <XIcon aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </header>
        {/* The page under the dialog is what a followed link opens, so the dialog steps aside. */}
        <LindaConversation layout="fill" onNavigate={hide} autoFocus={false} inputRef={inputRef} />
      </DialogContent>
    </Dialog>
  );
}
