import { formatDateTime } from "@/lib/format";
import type { CicSubmissionHistoryEntry } from "@/types/cic";
import { staffName } from "../../../_lib/labels";

/** Each status the file reached, when and by whom, as the server recorded it. */
export function StatusHistory({ history }: { history: CicSubmissionHistoryEntry[] }) {
  return (
    <ol className="space-y-2 border-l pl-4 text-sm">
      {history.map((h, n) => (
        <li key={`${h.status}-${n}`}>
          <span className="font-medium">{h.status_label}</span>
          <span className="text-muted-foreground">
            {" "}
            · {formatDateTime(h.at)}
            {h.by ? ` by ${staffName(h.by)}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
