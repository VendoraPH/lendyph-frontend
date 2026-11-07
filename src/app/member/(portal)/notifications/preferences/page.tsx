"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useApiResource } from "@/hooks/use-api-resource";
import { notifyError, notifySuccess } from "@/lib/notify";
import { CHANNELS, NOTIFICATION_CATEGORIES, preferenceLocked, setPreference } from "@/lib/portal/engagement";
import { portalService } from "@/services/portal.service";
import type { PortalNotificationPreference } from "@/types/portal";
import { PortalPageHeader } from "../../../_components/portal-shell";

export default function NotificationPreferencesPage() {
  const fetcher = useCallback(() => portalService.notificationPreferences(), []);
  const resource = useApiResource(fetcher);

  return (
    <>
      <Link
        href="/member/notifications"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Notifications
      </Link>
      <PortalPageHeader
        title="Notification preferences"
        description="Choose how the cooperative reaches you. Security alerts are always sent."
      />
      <DataState
        resource={resource}
        endpoints={["GET /portal/notification-preferences", "PUT /portal/notification-preferences"]}
        summary="Your notification choices will show here once online access is connected."
        isEmpty={(rows) => rows.length === 0}
      >
        {/* Keyed on the loaded rows so a reload starts the form over. */}
        {(rows) => <PreferencesForm key={JSON.stringify(rows)} initial={rows} />}
      </DataState>
    </>
  );
}

function PreferencesForm({ initial }: { initial: PortalNotificationPreference[] }) {
  const [prefs, setPrefs] = useState(initial);
  // What the server last confirmed, so the button greys out again after a save.
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);

  const save = () => {
    setBusy(true);
    portalService
      .saveNotificationPreferences(prefs)
      .then((body) => {
        const next = Array.isArray(body) ? body : prefs;
        setPrefs(next);
        setSaved(next);
        notifySuccess("Preferences saved");
      })
      .catch((err) => notifyError(err, "Your preferences could not be saved."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Notification</th>
                {CHANNELS.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-center font-medium">
                    {c.label}
                    {c.future && <span className="block text-[11px] font-normal">Coming soon</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {prefs.map((p) => (
                <tr key={p.category}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{NOTIFICATION_CATEGORIES[p.category] ?? p.category}</span>
                    {p.mandatory && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" aria-hidden /> Required for your account&apos;s security
                      </span>
                    )}
                  </td>
                  {CHANNELS.map((c) => (
                    <td key={c.key} className="px-3 py-3 text-center">
                      <Switch
                        aria-label={`${NOTIFICATION_CATEGORIES[p.category] ?? p.category} by ${c.label}`}
                        checked={c.future ? false : p[c.key]}
                        disabled={preferenceLocked(p, c.key) || busy}
                        onCheckedChange={(v) => setPrefs((all) => setPreference(all, p.category, c.key, v))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save preferences
        </Button>
      </div>
    </div>
  );
}
