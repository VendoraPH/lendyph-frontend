"use client";

import { Lock, LockOpen } from "lucide-react";
import { AccessDenied } from "@/components/common/access-denied";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMenuVisibilityPage } from "../_hooks/use-menu-visibility-page";
import { accessEndsText } from "../_lib/menu-visibility-view";
import { ModuleSwitchList } from "./module-switch-list";
import { OverridePasswordDialog } from "./override-password-dialog";

/**
 * Settings → Menu Visibility: an on or off switch for each menu this build
 * has. A hidden menu goes from the side menu with its submenus, pages and
 * settings, and its API answers not found; nothing is deleted. The page opens
 * only after the administrator password (15 minutes, this sign-in only).
 */
export function MenuVisibilityScreen() {
  const page = useMenuVisibilityPage();
  if (page.status === "denied") return <AccessDenied pageName="Menu Visibility" />;

  const open = page.status === "ready";
  const endsAt = open ? accessEndsText(page.expiresAt) : null;

  return (
    <PageFill>
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menu Visibility</h1>
          <p className="text-sm text-muted-foreground">
            Choose which menus this deployment shows. A hidden menu leaves the side menu with its submenus, pages and
            settings; nothing is deleted, and turning it back on restores it as it was. Settings is always on.
          </p>
        </div>
        {open && (
          <div className="flex items-center gap-3">
            {endsAt && <span className="text-sm text-muted-foreground">{endsAt}</span>}
            <Button variant="outline" onClick={page.lock} disabled={page.submitting}>
              <Lock className="h-4 w-4" aria-hidden="true" />
              Lock
            </Button>
          </div>
        )}
      </div>

      {page.status === "loading" && !page.hasList && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      {page.status === "error" && (
        <div className="shrink-0 rounded-lg border p-4 text-sm">
          <p>Menu Visibility couldn&apos;t be loaded. Please try again.</p>
          <Button variant="outline" className="mt-3" onClick={page.retry}>
            Try again
          </Button>
        </div>
      )}

      {page.status === "locked" && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <p>
            {page.hasList
              ? "Access has ended. Enter the administrator password again to save your changes; they are kept."
              : "Enter the administrator password to open Menu Visibility."}
          </p>
          <Button onClick={() => page.setAskPassword(true)}>
            <LockOpen className="h-4 w-4" aria-hidden="true" />
            Enter password
          </Button>
        </div>
      )}

      {page.hasList && (
        <FillSection className="gap-4">
          <ScrollBox className="p-px">
            <ModuleSwitchList rows={page.rows} locked={!open || page.submitting} onToggle={page.toggle} />
          </ScrollBox>
          <div data-fab-clear className="flex shrink-0 items-center justify-end gap-3 border-t pt-4">
            {page.summary && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
            <Button onClick={() => page.setConfirming(page.summary)} disabled={!open || !page.summary || page.submitting}>
              Save
            </Button>
          </div>
        </FillSection>
      )}

      <OverridePasswordDialog
        open={page.askPassword}
        onOpenChange={page.setAskPassword}
        onUnlocked={page.unlocked}
        onDenied={page.denied}
      />

      <AlertDialog open={page.confirming !== null} onOpenChange={(next) => !next && !page.submitting && page.setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save menu visibility?</AlertDialogTitle>
            <AlertDialogDescription>
              {page.confirming} This changes the menus for everyone on this deployment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={page.submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={page.save} disabled={page.submitting}>
              {page.submitting && <Spinner className="mr-2 h-4 w-4" />}
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFill>
  );
}
