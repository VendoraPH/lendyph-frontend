"use client";

import { useEffect } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import { PageFill } from "@/components/common/page-fill";
import { Card, CardContent } from "@/components/ui/card";
import { FIT_CLASSES } from "@/lib/page-fill";
import { useLindaStore } from "@/store";
import { LindaBust } from "@/components/linda/linda-avatar";
import { LindaConversation } from "@/components/linda/linda-conversation";
import { LindaNewChatButton } from "@/components/linda/linda-new-chat-button";

/** Linda on a full page: the same conversation as the floating button's panel. */
export default function LindaPage() {
  return (
    <RouteGuard permission="linda:use" pageName="Linda">
      <LindaScreen />
    </RouteGuard>
  );
}

function LindaScreen() {
  // The page shows the conversation itself, so the panel and the expanded
  // chat step aside. Nothing is cleared: what was asked there carries on here.
  useEffect(() => {
    useLindaStore.getState().hide();
  }, []);

  return (
    <PageFill className="gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <LindaBust decorative className="size-12 rounded-full bg-brand-orange/10 ring-1 ring-brand-orange/25" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Linda</h1>
            <p className="text-sm text-muted-foreground">AI Lending Assistant</p>
          </div>
        </div>
        <LindaNewChatButton labelled />
      </div>

      <Card className={FIT_CLASSES.section}>
        <CardContent className={FIT_CLASSES.section}>
          <LindaConversation layout="page" onNavigate={() => {}} autoFocus={false} />
        </CardContent>
      </Card>
    </PageFill>
  );
}
