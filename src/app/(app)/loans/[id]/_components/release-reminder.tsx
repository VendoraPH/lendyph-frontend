import { Printer } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * A reminder in the Release dialog to print a signed document again after
 * release (`_lib/release-reminders.ts`). A calm status note: it never holds
 * Confirm Release. Nothing shows without a reminder.
 */
export function ReleaseReminder({ text }: { text: string | null }) {
  if (text === null) return null;
  return (
    <Alert role="status">
      <Printer aria-hidden="true" />
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}
