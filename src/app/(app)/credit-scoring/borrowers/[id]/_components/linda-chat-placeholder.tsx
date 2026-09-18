// src/app/(app)/credit-scoring/borrowers/[id]/_components/linda-chat-placeholder.tsx

import { MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Linda chat integration is Phase 2+ per the design spec — this is
 * intentionally inert. Never wire this to a real endpoint or show sample
 * conversation content; a fabricated chat transcript is worse than none.
 */
export function LindaChatPlaceholder() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
        <MessageCircle className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Ask Linda</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Conversational score explanations are coming in a future phase.
        </p>
      </CardContent>
    </Card>
  );
}
