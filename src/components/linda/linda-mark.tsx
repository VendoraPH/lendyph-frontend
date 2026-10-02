import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Linda's avatar: the one mark used on the header button, panel and replies. */
export function LindaMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-orange text-brand-orange-foreground",
        className,
      )}
    >
      <Sparkles className="size-3.5" />
    </span>
  );
}
