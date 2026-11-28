import { Badge } from "@/components/ui/badge";
import type { CicSubmissionStatus } from "@/types/cic";

const VARIANT: Record<CicSubmissionStatus, "default" | "secondary" | "destructive" | "outline"> = {
  generated: "outline",
  encrypted: "secondary",
  submitted: "secondary",
  accepted: "default",
  rejected: "destructive",
};

/** The server's own words for the status. */
export function SubmissionStatusBadge({ status, label }: { status: CicSubmissionStatus; label: string }) {
  return <Badge variant={VARIANT[status]}>{label}</Badge>;
}
