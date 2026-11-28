import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermission } from "@/hooks";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CicStatus } from "@/types/cic";
import { captureLabel } from "../_lib/labels";

/** Whether CIC reporting is set up to make a file: provider code, CIC's key and the last capture. */
export function StatusCard({ status }: { status: CicStatus }) {
  const { can } = usePermission();
  const key = status.active_key;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Set-up</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-muted-foreground">Provider code</dt>
          <dd>{status.provider_code_set ? "Set" : "Not set: no file can be made until it is"}</dd>
          <dt className="text-muted-foreground">File format</dt>
          <dd>CSDF version {status.format_version}</dd>
          <dt className="text-muted-foreground">CIC&apos;s public key</dt>
          <dd className="break-all">
            {key ? (
              <>
                <span className="font-mono text-xs">{key.key_id}</span>
                {key.expired
                  ? " · expired"
                  : key.expires_at
                    ? ` · expires ${formatDate(key.expires_at)}`
                    : " · no expiry"}
              </>
            ) : (
              "No active key: files can't be encrypted"
            )}
          </dd>
          <dt className="text-muted-foreground">Last capture</dt>
          <dd>
            {status.last_capture
              ? `${captureLabel(status.last_capture)}${status.last_capture.finished_at ? `, ${formatDateTime(status.last_capture.finished_at)}` : ""}`
              : "None yet. Month-end captures run at 23:58 on each month's last day."}
          </dd>
        </dl>
        {status.test_captures && (
          <p className="text-xs text-muted-foreground">Test captures are on here, so a test file can be made on any day.</p>
        )}
        {can("cic:settings") && (!status.provider_code_set || !key || key.expired) && (
          <Link href="/settings/cic" className="text-sm underline">
            Finish the set-up in CIC Settings
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
