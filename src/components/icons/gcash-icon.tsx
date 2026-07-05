import { cn } from "@/lib/utils";

export function GCashIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/Logo/gcash-logo.png"
      alt="GCash"
      className={cn(className, "h-full w-full object-contain")}
    />
  );
}
