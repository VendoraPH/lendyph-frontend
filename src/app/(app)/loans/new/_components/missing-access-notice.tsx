import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MissingAccess } from "../_lib/missing-access";

interface MissingAccessNoticeProps {
  missing: MissingAccess[];
  className?: string;
}

/**
 * Says which lists this form could not show because of the user's role, and
 * what an admin should grant. Red when the loan can't be created without the
 * missing access, amber when only a preview or an optional step is affected.
 */
export function MissingAccessNotice({ missing, className }: MissingAccessNoticeProps) {
  if (missing.length === 0) return null;
  const blocking = missing.some((m) => m.blocking);

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        blocking
          ? "border-destructive/40 bg-destructive/10"
          : "border-amber-500/40 bg-amber-500/10",
        className,
      )}
    >
      <Lock
        className={cn("mt-0.5 size-5 shrink-0", blocking ? "text-destructive" : "text-amber-600")}
        aria-hidden="true"
      />
      <div className="min-w-0 text-sm">
        <p className={cn("font-medium", blocking ? "text-destructive" : "text-amber-900 dark:text-amber-200")}>
          {blocking
            ? "Your role can't see everything this form needs."
            : "Your role can't see part of this form."}
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
          {missing.map((m) => (
            <li key={m.permission}>{m.effect}</li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">
          Ask an admin to add{" "}
          {missing.map((m, i) => (
            <span key={m.permission}>
              {i > 0 && (i === missing.length - 1 ? " and " : ", ")}
              <span className="font-medium text-foreground">{m.grant}</span>
            </span>
          ))}{" "}
          to your role in Settings → User Roles, then sign out and back in.
        </p>
      </div>
    </div>
  );
}
