"use client";

import { SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLindaStore } from "@/store";
import { Button } from "@/components/ui/button";

/**
 * Clears the conversation (and aborts a question in flight), leaving Linda
 * open. Disabled while there's nothing to clear. `labelled` shows the words,
 * for the /linda page; the panel and dialog use the icon with a label.
 */
export function LindaNewChatButton({ labelled = false, className }: { labelled?: boolean; className?: string }) {
  const empty = useLindaStore((s) => s.messages.length === 0 && s.draft === "");
  const newChat = useLindaStore((s) => s.newChat);

  return (
    <Button
      type="button"
      variant={labelled ? "outline" : "ghost"}
      size={labelled ? "sm" : "icon-sm"}
      onClick={newChat}
      disabled={empty}
      aria-label={labelled ? undefined : "New chat"}
      title={labelled ? undefined : "New chat"}
      className={cn(!labelled && "rounded-full", className)}
    >
      <SquarePen aria-hidden="true" className={labelled ? "size-4" : "h-4 w-4"} />
      {labelled && "New chat"}
    </Button>
  );
}
