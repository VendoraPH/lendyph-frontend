import { AxiosError } from "axios";

interface ApiErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

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

    if (body?.errors) {
      const firstField = Object.keys(body.errors)[0];
      const firstMsg = firstField && body.errors[firstField]?.[0];
      if (firstMsg) return firstMsg;
    }
    if (body?.message) return body.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
