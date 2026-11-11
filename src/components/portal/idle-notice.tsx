"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { idlePhase, type IdlePhase } from "@/lib/portal/idle";
import { portalService } from "@/lib/portal/portal-api";
import { endPortalSession, lastActivity, SESSION_END_WORDS } from "@/lib/portal/portal-client";

const CHECK_MS = 5_000;

/**
 * Warns before the server's idle timeout (`idle_minutes`) signs the member
 * out, and signs out at the line with the server's `session_idle` words.
 * "Stay signed in" makes one request, which is what keeps the server's
 * window open.
 */
export function IdleNotice({ idleMinutes }: { idleMinutes: number }) {
  const [phase, setPhase] = useState<IdlePhase>("active");
  const [staying, setStaying] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = idlePhase(lastActivity(), idleMinutes, Date.now());
      setPhase(next);
      if (next === "expired") {
        window.clearInterval(timer);
        portalService
          .logout()
          .catch(() => undefined)
          .then(() => endPortalSession(SESSION_END_WORDS.session_idle));
      }
    }, CHECK_MS);
    return () => window.clearInterval(timer);
  }, [idleMinutes]);

  const stay = () => {
    setStaying(true);
    portalService
      .me()
      .then(() => setPhase("active"))
      .catch(() => undefined)
      .then(() => setStaying(false));
  };

  return (
    <Dialog open={phase === "warning"} onOpenChange={(open) => !open && stay()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Are you still there?</DialogTitle>
          <DialogDescription>
            For your security, you&apos;ll be signed out in about a minute because nothing has happened for a while.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={stay} disabled={staying}>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
