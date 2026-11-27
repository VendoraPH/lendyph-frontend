"use client";

import { useEffect, useMemo, useState } from "react";
import { httpStatusOf } from "@/lib/api-error";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { menuVisibilityService } from "@/services/menu-visibility.service";
import { useMenuVisibilityStore } from "@/store/menu-visibility-store";
import type { MenuVisibilitySettings } from "@/types/menu-visibility";
import {
  draftFrom,
  hiddenPayload,
  isOverrideRequired,
  menuVisibilityRows,
  msUntil,
  saveSummary,
} from "../_lib/menu-visibility-view";

/** Where the page is: loading, open (an override is active), locked (password needed), refused, or failed. */
export type MenuVisibilityStatus = "loading" | "ready" | "locked" | "denied" | "error";

/**
 * Settings → Menu Visibility's state. The switches are a working copy
 * (`draft`) that survives the override ending: when it expires, or the server
 * answers 403 `override_required`, the page asks for the password again and
 * the unsaved switches stay as they were.
 */
export function useMenuVisibilityPage() {
  const [status, setStatus] = useState<MenuVisibilityStatus>("loading");
  const [settings, setSettings] = useState<MenuVisibilitySettings | null>(null);
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [askPassword, setAskPassword] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const { submitting, run } = useSubmitGuard();
  const refreshVisibility = useMenuVisibilityStore((s) => s.load);

  const lockedOut = () => {
    setStatus("locked");
    setAskPassword(true);
  };

  useEffect(() => {
    let cancelled = false;
    menuVisibilityService.settings().then(
      (answer) => {
        if (cancelled) return;
        setSettings(answer);
        // Coming back after the password, unsaved switches are kept.
        setDraft((current) => current ?? draftFrom(answer.modules));
        setExpiresAt(answer.override_expires_at);
        setStatus("ready");
      },
      (err: unknown) => {
        if (cancelled) return;
        if (isOverrideRequired(err)) {
          setStatus("locked");
          setAskPassword(true);
        } else setStatus(httpStatusOf(err) === 403 ? "denied" : "error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  // When the override ends, ask for the password again.
  useEffect(() => {
    if (status !== "ready" || !expiresAt) return;
    const timer = setTimeout(() => {
      setStatus("locked");
      setAskPassword(true);
    }, msUntil(expiresAt, Date.now()));
    return () => clearTimeout(timer);
  }, [status, expiresAt]);

  const modules = useMemo(() => settings?.modules ?? [], [settings]);
  const saved = useMemo(() => draftFrom(modules), [modules]);
  const rows = useMemo(() => (draft ? menuVisibilityRows(modules, draft) : []), [modules, draft]);
  const summary = draft ? saveSummary(saved, draft, modules) : null;

  function toggle(key: string, shown: boolean) {
    setDraft((current) => {
      const next = new Set(current ?? []);
      if (shown) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function unlocked(until: string) {
    setAskPassword(false);
    setExpiresAt(until);
    setReloadCount((n) => n + 1);
  }

  function save() {
    if (!draft || !summary) return;
    const said = summary;
    run(() => menuVisibilityService.save(hiddenPayload(draft)))
      ?.then((answer) => {
        setConfirming(null);
        setSettings(answer);
        setDraft(draftFrom(answer.modules));
        setExpiresAt(answer.override_expires_at);
        // The menus change at once, not on the next focus.
        void refreshVisibility();
        notifySuccess("Menu visibility saved", said);
      })
      .catch((err: unknown) => {
        setConfirming(null);
        if (isOverrideRequired(err)) lockedOut();
        else notifyError(err, "Menu visibility couldn't be saved.");
      });
  }

  function lock() {
    run(() => menuVisibilityService.lock())
      ?.then(() => {
        setExpiresAt(null);
        setStatus("locked");
      })
      .catch((err: unknown) => notifyError(err, "Menu Visibility couldn't be locked."));
  }

  function retry() {
    setStatus("loading");
    setReloadCount((n) => n + 1);
  }

  return {
    status,
    rows,
    hasList: draft !== null && settings !== null,
    summary,
    expiresAt,
    submitting,
    askPassword,
    setAskPassword,
    confirming,
    setConfirming,
    toggle,
    unlocked,
    denied: () => {
      setAskPassword(false);
      setStatus("denied");
    },
    save,
    lock,
    retry,
  };
}
