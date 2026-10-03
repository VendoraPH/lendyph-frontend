import { AxiosError } from "axios";
import { getErrorMessage } from "./api-error";

interface ApiErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

// GCash-specific friendly copy for a few domain cases, then falls through to the
// shared getErrorMessage helper (status-code map + leak guard) for everything else.
export function extractGCashErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const body = err.response?.data as ApiErrorBody | undefined;

    if (status === 422 && body?.message?.toLowerCase().includes("tier")) {
      return "No tier covers this amount. Update GCash settings.";
    }
    if (status === 409) {
      return "Looks like a duplicate — a similar transaction was just recorded.";
    }
    if (status === 403) {
      return "You don't have permission to record GCash transactions.";
    }
  }
  return getErrorMessage(
    err,
    "Something went wrong with that GCash action. Please try again."
  );
}
